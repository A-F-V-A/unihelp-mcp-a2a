"""Piezas comunes de las familias: contexto, resultados, poblaciones y umbrales.

Una funcion de calculo recibe la ficha de su metrica y el contexto, y devuelve un
`ResultadoMetrica`. Nunca conoce un nombre de campo: pide columnas por alias a la
ficha (`metrica.columna('latencia')`).
"""

from __future__ import annotations

import json
import math
import unicodedata
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from types import MappingProxyType
from typing import Any, Literal

import pandas as pd

from ..inferencia import (
    AGREGADORES,
    ConfiguracionBootstrap,
    Estimacion,
    Intervalo,
    MatrizTareas,
    bootstrap_contraste,
    bootstrap_por_arquitectura,
)
from ..registro import ErrorRegistro, Metrica, Registro, columna

COLUMNA_VALOR = '_valor'
ALIAS_ESTADO_FINAL = 'estado_final'
ARTEFACTO_TAREAS = 'tareas'


@dataclass(frozen=True)
class Fila:
    """Un valor reportado: por arquitectura (o global) y opcionalmente desglosado."""

    arquitectura: str | None
    estadistico: str
    valor: float | None
    dimensiones: Mapping[str, str] = field(default_factory=dict)
    intervalo: Intervalo | None = None
    n_tareas: int | None = None
    n_observaciones: int | None = None


@dataclass(frozen=True)
class Contraste:
    """Diferencia pareada por tarea entre dos arquitecturas. Estima; no decide."""

    minuendo: str
    sustraendo: str
    estadistico: str
    estimacion: Estimacion
    dimensiones: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ResultadoMetrica:
    codigo: str
    estado: Literal['calculada', 'sin_datos']
    filas: tuple[Fila, ...] = ()
    contrastes: tuple[Contraste, ...] = ()
    # Lo que se compara con el umbral del registro. Se ignora en metricas de resultado abierto.
    observado_umbral: float | Mapping[str, float | None] | None = None
    motivo_estado: str | None = None
    notas: tuple[str, ...] = ()

    def valor(
        self, estadistico: str, arquitectura: str | None = None, **dimensiones: str
    ) -> float | None:
        """Busca el valor de una fila. Falla si no existe exactamente una."""
        halladas = [
            f
            for f in self.filas
            if f.estadistico == estadistico
            and f.arquitectura == arquitectura
            and dict(f.dimensiones) == dimensiones
        ]
        if len(halladas) != 1:
            raise KeyError(f'{self.codigo}: {len(halladas)} filas para {estadistico} {arquitectura} {dimensiones}')
        return halladas[0].valor


@dataclass(frozen=True)
class Contexto:
    """Todo lo que una funcion de calculo puede leer."""

    registro: Registro
    ejecuciones: pd.DataFrame
    intentos: pd.DataFrame
    insumos: Mapping[str, Any]
    configuracion: ConfiguracionBootstrap
    directorio_corrida: Path

    @property
    def col_ejecucion(self) -> str:
        return self.registro.columna_identidad('ejecucion')

    @property
    def col_tarea(self) -> str:
        return self.registro.columna_identidad('tarea')

    @property
    def col_arquitectura(self) -> str:
        return self.registro.columna_identidad('arquitectura')

    @property
    def col_repeticion(self) -> str:
        return self.registro.columna_identidad('repeticion')

    @property
    def col_categoria(self) -> str:
        return columna(ARTEFACTO_TAREAS, self.registro.campo_categoria)

    def categorias_por_tarea(self) -> dict[str, str]:
        if self.col_categoria not in self.ejecuciones.columns:
            return {}
        pares = self.ejecuciones[[self.col_tarea, self.col_categoria]].drop_duplicates()
        return dict(zip(pares[self.col_tarea], pares[self.col_categoria], strict=True))


FuncionMetrica = Callable[[Metrica, Contexto], ResultadoMetrica]
_IMPLEMENTACIONES: dict[str, FuncionMetrica] = {}


def implementa(codigo: str) -> Callable[[FuncionMetrica], FuncionMetrica]:
    """Declara que la funcion calcula la metrica `codigo` del registro."""

    def registrar(funcion: FuncionMetrica) -> FuncionMetrica:
        if codigo in _IMPLEMENTACIONES:
            raise ErrorRegistro(f'La metrica {codigo} esta implementada dos veces')
        _IMPLEMENTACIONES[codigo] = funcion
        return funcion

    return registrar


def implementaciones() -> Mapping[str, FuncionMetrica]:
    return MappingProxyType(_IMPLEMENTACIONES)


def sin_datos(metrica: Metrica, motivo: str) -> ResultadoMetrica:
    return ResultadoMetrica(metrica.codigo, 'sin_datos', motivo_estado=motivo)


def poblacion(metrica: Metrica, ctx: Contexto) -> pd.DataFrame:
    """Ejecuciones que entran al calculo segun la tabla de estados finales (seccion 13).

    En efectividad entran las que se incluyen y las que cuentan como fallo; en latencia y
    costo, solo las que se incluyen.
    """
    dimension = metrica.poblacion
    if dimension is None:
        raise ErrorRegistro(f'{metrica.codigo}: falta implementacion.poblacion')
    aceptados = ('incluye', 'fallo') if dimension == 'efectividad' else ('incluye',)
    estados = ctx.registro.estados_donde(dimension, *aceptados)
    datos = ctx.ejecuciones
    return datos[datos[metrica.columna(ALIAS_ESTADO_FINAL)].isin(estados)].copy()


def por_tarea(ctx: Contexto, datos: pd.DataFrame, columna_valor: str, agregacion: str) -> pd.DataFrame:
    """Una fila por (tarea, arquitectura): agrega las repeticiones DENTRO de la tarea."""
    funcion = {'media': 'mean', 'mediana': 'median'}[agregacion]
    return (
        datos.groupby([ctx.col_tarea, ctx.col_arquitectura], sort=True)[columna_valor]
        .agg(funcion)
        .rename(COLUMNA_VALOR)
        .reset_index()
    )


def matriz_tareas(ctx: Contexto, tabla: pd.DataFrame) -> MatrizTareas:
    return MatrizTareas.desde_tabla(
        tabla,
        columna_tarea=ctx.col_tarea,
        columna_arquitectura=ctx.col_arquitectura,
        columna_valor=COLUMNA_VALOR,
        arquitecturas=ctx.registro.arquitecturas,
    )


def conteo_por_arquitectura(ctx: Contexto, datos: pd.DataFrame) -> dict[str, int]:
    conteo = datos.groupby(ctx.col_arquitectura).size()
    return {a: int(conteo.get(a, 0)) for a in ctx.registro.arquitecturas}


def nombre_estadistico(metrica: Metrica) -> str:
    return f'{metrica.agregacion_tareas}_entre_tareas'


def estimar(ctx: Contexto, metrica: Metrica, matriz: MatrizTareas) -> dict[str, Estimacion]:
    agregacion = metrica.agregacion_tareas
    if agregacion is None:
        raise ErrorRegistro(f'{metrica.codigo}: falta implementacion.agregacion_tareas')
    if metrica.con_intervalo:
        return bootstrap_por_arquitectura(matriz, agregacion, ctx.configuracion)
    puntual = AGREGADORES[agregacion](matriz.valores, axis=0)
    return {
        a: Estimacion(None if math.isnan(puntual[i]) else float(puntual[i]), None, matriz.n_tareas)
        for i, a in enumerate(matriz.arquitecturas)
    }


def filas_desde_estimaciones(
    estimaciones: Mapping[str, Estimacion],
    estadistico: str,
    *,
    dimensiones: Mapping[str, str] | None = None,
    n_observaciones: Mapping[str, int] | None = None,
    escala: float = 1.0,
) -> list[Fila]:
    filas = []
    for arquitectura, est in estimaciones.items():
        intervalo = est.intervalo
        if intervalo is not None and escala != 1.0:
            intervalo = Intervalo(intervalo.inferior * escala, intervalo.superior * escala, intervalo.nivel)
        filas.append(
            Fila(
                arquitectura=arquitectura,
                estadistico=estadistico,
                valor=None if est.valor is None else est.valor * escala,
                dimensiones=dict(dimensiones or {}),
                intervalo=intervalo,
                n_tareas=est.n_tareas,
                n_observaciones=None if n_observaciones is None else n_observaciones.get(arquitectura, 0),
            )
        )
    return filas


def contrastes_pareados(
    ctx: Contexto,
    metrica: Metrica,
    matriz: MatrizTareas,
    *,
    dimensiones: Mapping[str, str] | None = None,
) -> list[Contraste]:
    """Contrastes declarados en `inferencia.contrastes`, solo si la metrica los pide."""
    if not metrica.con_contrastes or metrica.agregacion_tareas is None:
        return []
    return [
        Contraste(
            minuendo=minuendo,
            sustraendo=sustraendo,
            estadistico=f'{metrica.agregacion_tareas}_de_diferencias_por_tarea',
            estimacion=bootstrap_contraste(
                matriz, minuendo, sustraendo, metrica.agregacion_tareas, ctx.configuracion
            ),
            dimensiones=dict(dimensiones or {}),
        )
        for minuendo, sustraendo in ctx.registro.inferencia['contrastes']
    ]


def valores_por_arquitectura(filas: list[Fila]) -> dict[str, float | None]:
    return {f.arquitectura: f.valor for f in filas if f.arquitectura is not None}


def _es_nulo(valor: Any) -> bool:
    return valor is None or (isinstance(valor, float) and math.isnan(valor))


def _comparar(operador: str, observado: float, referencia: float) -> bool:
    if operador == '==':
        return math.isclose(observado, referencia, rel_tol=1e-9, abs_tol=1e-9)
    return {
        '>=': observado >= referencia,
        '<=': observado <= referencia,
        '>': observado > referencia,
        '<': observado < referencia,
    }[operador]


def evaluar_umbral(umbral: Mapping[str, Any], observado: Any) -> bool | None:
    """Compara lo observado con el umbral del registro. None si no se puede evaluar.

    Con un valor por arquitectura, se exige en las arquitecturas que el umbral nombra o,
    si no nombra ninguna, en todas.
    """
    if _es_nulo(observado):
        return None
    operador = umbral['operador']
    arquitecturas = umbral.get('arquitecturas')
    if operador == 'igual_entre_arquitecturas':
        if not isinstance(observado, Mapping) or not arquitecturas:
            return None
        valores = [observado.get(a) for a in arquitecturas]
        if any(_es_nulo(v) for v in valores):
            return None
        return all(math.isclose(v, valores[0], rel_tol=1e-9, abs_tol=1e-9) for v in valores)
    if isinstance(observado, Mapping):
        valores = [observado.get(a) for a in (arquitecturas or sorted(observado))]
    else:
        valores = [observado]
    if not valores or any(_es_nulo(v) for v in valores):
        return None
    return all(_comparar(operador, float(v), float(umbral['valor'])) for v in valores)


# --- Piezas de M2, M3 y M5: listas de la traza y agregacion por tarea --------------------------


def como_lista(valor: Any) -> list[Any]:
    """Lista de un campo que la carga guardo como JSON (`tool_calls[].nombre`). [] si falta."""
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return []
    if isinstance(valor, str):
        valor = json.loads(valor)
    return list(valor) if isinstance(valor, list) else []


def como_objeto(valor: Any) -> Any:
    """Objeto o lista guardado como JSON por la carga; los escalares pasan sin cambio."""
    if isinstance(valor, str) and valor[:1] in ('[', '{'):
        return json.loads(valor)
    if isinstance(valor, float) and math.isnan(valor):
        return None
    return valor


def normalizar_texto(valor: Any) -> str:
    """Minusculas sin tildes ni espacios de borde: la misma regla que la compuerta del ejecutor."""
    texto = unicodedata.normalize('NFD', str(valor)).casefold()
    return ''.join(c for c in texto if unicodedata.category(c) != 'Mn').strip()


def agregado_por_tarea(
    metrica: Metrica,
    ctx: Contexto,
    datos: pd.DataFrame,
    columna_valor: str,
    *,
    dimensiones: Mapping[str, str] | None = None,
    contrastes: bool = True,
) -> tuple[dict[str, Estimacion], list[Fila], list[Contraste]]:
    """Valor por ejecucion -> agregado por tarea -> estimacion entre tareas, con su intervalo.

    Las ejecuciones con valor NaN (la metrica no aplica a esa tarea) se descartan antes
    de agregar: una tarea sin ejecuciones aplicables no entra al denominador.
    """
    aplicables = datos[datos[columna_valor].notna()]
    if aplicables.empty:
        return {}, [], []
    matriz = matriz_tareas(ctx, por_tarea(ctx, aplicables, columna_valor, metrica.agregacion_tareas or ''))
    estimaciones = estimar(ctx, metrica, matriz)
    filas = filas_desde_estimaciones(
        estimaciones,
        nombre_estadistico(metrica),
        dimensiones=dimensiones,
        n_observaciones=conteo_por_arquitectura(ctx, aplicables),
    )
    pares = contrastes_pareados(ctx, metrica, matriz, dimensiones=dimensiones) if contrastes else []
    return estimaciones, filas, pares


def filas_conteo(
    ctx: Contexto,
    datos: pd.DataFrame,
    columna_evento: str,
    *,
    estadistico: str = 'conteo',
    dimensiones: Mapping[str, str] | None = None,
) -> list[Fila]:
    """Conteo absoluto de eventos por arquitectura y en la corrida completa (M5)."""
    filas = []
    for arquitectura in ctx.registro.arquitecturas:
        de_arquitectura = datos[datos[ctx.col_arquitectura] == arquitectura]
        filas.append(
            Fila(arquitectura, estadistico, float(de_arquitectura[columna_evento].sum()),
                 dict(dimensiones or {}), n_observaciones=len(de_arquitectura))
        )
    filas.append(
        Fila(None, estadistico, float(datos[columna_evento].sum()), dict(dimensiones or {}),
             n_observaciones=len(datos))
    )
    return filas


def cota_superior_binomial(eventos: int, n: int, nivel: float) -> float | None:
    """Limite superior exacto (Clopper-Pearson) UNILATERAL de la tasa.

    Con 0 eventos es 1 - alfa^(1/n): con 800 ejecuciones y 95 %, ~0,37 % (ficha de M5.1).
    """
    if n == 0:
        return None
    if eventos >= n:
        return 1.0
    cola = 1 - nivel

    def acumulada(p: float) -> float:
        return sum(math.comb(n, k) * p**k * (1 - p) ** (n - k) for k in range(eventos + 1))

    # La cota es la p con P(X <= eventos | p) = cola; la acumulada decrece con p.
    bajo, alto = eventos / n, 1.0
    for _ in range(80):
        medio = (bajo + alto) / 2
        bajo, alto = (medio, alto) if acumulada(medio) > cola else (bajo, medio)
    return (bajo + alto) / 2
