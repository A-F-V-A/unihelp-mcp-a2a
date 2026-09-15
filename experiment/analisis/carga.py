"""Pipeline de carga: lee trazas JSONL, las valida y consolida a Parquet.

Aqui se decide que intento entra al conjunto oficial. Un intento se RECHAZA (y
nunca llega a `ejecuciones.parquet`) por cualquiera de estos motivos:

- `json_malformado`: la linea no es JSON.
- `esquema_invalido`: no valida contra `schemas/traza.schema.json`, o viene de la
  cuarentena de `libs/trazas` (ya fue rechazada antes de persistir).
- `sin_consumo_tokens`: los tokens registrados suman cero (HU-MET-01).
- `residuo_orquestacion_negativo`: total - (modelo + herramienta + transporte) < 0.
  Es un defecto de instrumentacion (HU-MET-07).
- `descomposicion_no_aditiva`: el residuo reportado no coincide con el recalculado.
- `estado_inicial_incorrecto`: la huella de estado no es la esperada para la tarea.
- `tarea_desconocida`: no existe la definicion de la tarea.
- `ejecucion_duplicada`: ya hubo un intento valido para la misma (tarea, arquitectura,
  repeticion). Los fallos de infraestructura NO cuentan: se reejecutan.

Los intentos validos con residuo por encima del umbral de aviso (15 %) se conservan
y se reportan como aviso. Todos los nombres de campo salen del registro.
"""

from __future__ import annotations

import json
import math
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
import yaml
from jsonschema import Draft202012Validator, FormatChecker

from .registro import ARTEFACTO_TRAZA, DIRECTORIO_TAREAS, Registro, columna

ARTEFACTO_VALIDACION = 'validacion'
ARTEFACTO_TAREAS = 'tareas'
ARTEFACTO_CUARENTENA = 'cuarentena'
# Artefactos con una fila por ejecucion que se unen a la tabla consolidada.
ARTEFACTOS_POR_EJECUCION = ('puntuaciones',)
# Artefactos que las familias consumen tal cual, sin unirlos a la tabla.
INSUMOS = (
    'huellas_esperadas',
    'bench_transporte',
    'calificacion_humana',
    'veredictos_juez',
    'reproduccion',
    'control_instrumentacion',
)

COLUMNA_VALIDA = columna(ARTEFACTO_VALIDACION, 'valida')
COLUMNA_MOTIVOS = columna(ARTEFACTO_VALIDACION, 'motivos')
COLUMNA_ORIGEN = columna(ARTEFACTO_VALIDACION, 'origen')
COLUMNA_HUELLA_COINCIDE = columna(ARTEFACTO_VALIDACION, 'huella_coincide')
COLUMNA_PROPORCION_RESIDUO = columna(ARTEFACTO_VALIDACION, 'proporcion_residuo')
SEPARADOR_MOTIVOS = '|'

MOTIVO_JSON_MALFORMADO = 'json_malformado'
MOTIVO_ESQUEMA_INVALIDO = 'esquema_invalido'
MOTIVO_SIN_CONSUMO_TOKENS = 'sin_consumo_tokens'
MOTIVO_RESIDUO_NEGATIVO = 'residuo_orquestacion_negativo'
MOTIVO_NO_ADITIVA = 'descomposicion_no_aditiva'
MOTIVO_ESTADO_INICIAL = 'estado_inicial_incorrecto'
MOTIVO_TAREA_DESCONOCIDA = 'tarea_desconocida'
MOTIVO_DUPLICADA = 'ejecucion_duplicada'

ARCHIVO_EJECUCIONES = 'ejecuciones.parquet'
ARCHIVO_INTENTOS = 'intentos.parquet'


class ErrorInsumo(ValueError):
    """Un artefacto distinto de la traza esta mal formado: el analisis no puede seguir."""


@dataclass(frozen=True)
class Rechazo:
    origen: str
    run_id: str | None
    motivos: tuple[str, ...]
    detalle: tuple[str, ...]


@dataclass(frozen=True)
class AvisoResiduo:
    run_id: str
    proporcion: float


@dataclass(frozen=True)
class Consolidado:
    """Resultado de la carga. `ejecuciones` solo contiene intentos validos."""

    ejecuciones: pd.DataFrame
    intentos: pd.DataFrame
    rechazos: tuple[Rechazo, ...]
    avisos: tuple[AvisoResiduo, ...]
    insumos: Mapping[str, Any]


def extraer(documento: Any, ruta: str) -> Any:
    """Valor en `ruta` (puntos; indices numericos en arreglos) o None si no existe."""
    actual = documento
    for segmento in ruta.split('.'):
        if isinstance(actual, Mapping) and segmento in actual:
            actual = actual[segmento]
        elif isinstance(actual, list) and segmento.isdigit() and int(segmento) < len(actual):
            actual = actual[int(segmento)]
        else:
            return None
    return actual


def _es_numero(valor: Any) -> bool:
    return isinstance(valor, int | float) and not isinstance(valor, bool) and math.isfinite(valor)


def _texto(valor: Any) -> str | None:
    return None if valor is None else str(valor)


def validador_de(esquema: Mapping[str, Any]) -> Draft202012Validator:
    return Draft202012Validator(esquema, format_checker=FormatChecker())


def errores_esquema(validador: Draft202012Validator, documento: Any) -> tuple[str, ...]:
    """Mensajes de error ordenados, para que el reporte sea identico entre corridas."""
    return tuple(
        sorted(
            f'{"/".join(map(str, e.absolute_path)) or "(raiz)"}: {e.message}'
            for e in validador.iter_errors(documento)
        )
    )


def leer_jsonl(ruta: Path) -> Iterator[tuple[str, Any, str | None]]:
    """(origen, documento, error) por linea no vacia. Una linea rota no detiene la lectura."""
    with ruta.open(encoding='utf-8') as archivo:
        for numero, linea in enumerate(archivo, start=1):
            if not linea.strip():
                continue
            origen = f'{ruta.name}:{numero}'
            try:
                yield origen, json.loads(linea), None
            except json.JSONDecodeError as error:
                yield origen, None, str(error)


def validar_instrumentacion(
    traza: Mapping[str, Any], registro: Registro
) -> tuple[list[str], list[str], float | None]:
    """Consumo de tokens y residuo de orquestacion. Devuelve (motivos, detalle, proporcion)."""
    motivos: list[str] = []
    detalle: list[str] = []

    campos_tokens = registro.validaciones['consumo_tokens']['campos']
    tokens = sum(v for v in (extraer(traza, c) for c in campos_tokens) if _es_numero(v))
    if tokens <= 0:
        motivos.append(MOTIVO_SIN_CONSUMO_TOKENS)
        detalle.append(f'tokens registrados ({" + ".join(campos_tokens)}) = {tokens}')

    reglas = registro.validaciones['residuo_orquestacion']
    total = extraer(traza, reglas['total'])
    componentes = [extraer(traza, c) for c in reglas['componentes']]
    reportado = extraer(traza, reglas['reportado'])
    proporcion: float | None = None
    if _es_numero(total) and all(_es_numero(c) for c in componentes):
        # Se redondea para no leer como negativo el ruido de coma flotante.
        residuo = round(total - sum(componentes), 6)
        if residuo < 0:
            motivos.append(MOTIVO_RESIDUO_NEGATIVO)
            detalle.append(f'residuo de orquestacion = {residuo} ms (debe ser >= 0)')
        else:
            if _es_numero(reportado) and abs(residuo - reportado) > reglas['tolerancia_ms']:
                motivos.append(MOTIVO_NO_ADITIVA)
                detalle.append(f'residuo recalculado {residuo} ms frente a reportado {reportado} ms')
            if total > 0:
                proporcion = residuo / total
    return motivos, detalle, proporcion


def cargar_insumo(registro: Registro, nombre: str, directorio_corrida: Path) -> Any:
    """Lee y valida un artefacto de la corrida. None si la corrida no lo trae.

    Un insumo mal formado detiene el analisis (ErrorInsumo). Las trazas de reproduccion
    NO se rechazan: una traza distinta es precisamente lo que mide M7.6.
    """
    ruta = registro.ruta_artefacto(nombre, directorio_corrida)
    if ruta is None or not ruta.exists():
        return None
    if registro.es_artefacto_traza(nombre):
        return [doc for _, doc, error in leer_jsonl(ruta) if error is None]

    esquema = registro.esquema_artefacto(nombre)
    validador = validador_de(esquema) if esquema is not None else None
    if ruta.suffix == '.jsonl':
        documentos = []
        for origen, documento, error in leer_jsonl(ruta):
            if error is not None:
                raise ErrorInsumo(f'{nombre} ({origen}): JSON malformado: {error}')
            documentos.append((origen, documento))
    else:
        documentos = [(ruta.name, json.loads(ruta.read_text(encoding='utf-8')))]
    if validador is not None:
        for origen, documento in documentos:
            errores = errores_esquema(validador, documento)
            if errores:
                raise ErrorInsumo(f'{nombre} ({origen}) no valida: {"; ".join(errores)}')
    datos = [documento for _, documento in documentos]
    return datos if ruta.suffix == '.jsonl' else datos[0]


class _LectorTareas:
    """Lee cada YAML de tarea una sola vez."""

    def __init__(self, directorio: Path, campos: tuple[str, ...]) -> None:
        self._directorio = directorio
        self._campos = campos
        self._cache: dict[str, dict[str, Any] | None] = {}

    def campos(self, tarea: str) -> dict[str, Any] | None:
        if tarea not in self._cache:
            ruta = self._directorio / f'{tarea}.yaml'
            if not ruta.exists():
                self._cache[tarea] = None
            else:
                documento = yaml.safe_load(ruta.read_text(encoding='utf-8'))
                self._cache[tarea] = {
                    columna(ARTEFACTO_TAREAS, c): extraer(documento, c) for c in self._campos
                }
        return self._cache[tarea]


def _leer_cuarentena(
    registro: Registro, directorio_corrida: Path
) -> Iterator[tuple[str, Any, list[str]]]:
    """Sobres escritos por `libs/trazas`: {traza, errores, ...}. Cada uno es un intento invalido."""
    directorio = registro.ruta_artefacto(ARTEFACTO_CUARENTENA, directorio_corrida)
    if directorio is None or not directorio.is_dir():
        return
    for ruta in sorted(directorio.glob('*.json')):
        origen = f'{directorio.name}/{ruta.name}'
        try:
            sobre = json.loads(ruta.read_text(encoding='utf-8'))
        except json.JSONDecodeError as error:
            yield origen, None, [f'sobre de cuarentena ilegible: {error}']
            continue
        errores = sobre.get('errores', []) if isinstance(sobre, Mapping) else []
        detalle = [json.dumps(e, ensure_ascii=False, sort_keys=True) for e in errores]
        yield origen, sobre.get('traza') if isinstance(sobre, Mapping) else None, detalle


def consolidar(
    directorio_corrida: Path,
    registro: Registro,
    directorio_tareas: Path = DIRECTORIO_TAREAS,
) -> Consolidado:
    """Valida cada intento de la corrida y construye la tabla consolidada."""
    ruta_trazas = registro.ruta_artefacto(ARTEFACTO_TRAZA, directorio_corrida)
    if ruta_trazas is None or not ruta_trazas.exists():
        raise FileNotFoundError(f'La corrida no tiene archivo de trazas: {ruta_trazas}')

    esquema_traza = registro.esquema_artefacto(ARTEFACTO_TRAZA)
    assert esquema_traza is not None
    validador = validador_de(esquema_traza)
    campos_traza = registro.campos_traza_requeridos()
    identidad = {n: registro.campo_identidad(n) for n in ('ejecucion', 'tarea', 'arquitectura', 'repeticion')}
    estados_reejecutables = set(registro.estados_reejecutables())

    reglas_estado = registro.estado_inicial
    huellas_doc = cargar_insumo(registro, reglas_estado['artefacto'], directorio_corrida)
    huellas = None if huellas_doc is None else extraer(huellas_doc, reglas_estado['campo_huellas'])

    campos_tareas = tuple(
        sorted({registro.campo_categoria, *registro.campos_de_artefacto(ARTEFACTO_TAREAS)})
    )
    lector_tareas = _LectorTareas(directorio_tareas, campos_tareas)

    intentos: list[dict[str, Any]] = []
    validas: list[dict[str, Any]] = []
    rechazos: list[Rechazo] = []
    avisos: list[AvisoResiduo] = []
    claves_validas: set[tuple[Any, Any, Any]] = set()

    def evaluar(origen: str, traza: Any, motivos: list[str], detalle: list[str]) -> None:
        es_objeto = isinstance(traza, Mapping)
        proporcion: float | None = None
        huella_coincide: bool | None = None
        campos_de_tarea: dict[str, Any] | None = None
        if es_objeto and not motivos:
            errores = errores_esquema(validador, traza)
            if errores:
                motivos.append(MOTIVO_ESQUEMA_INVALIDO)
                detalle.extend(errores)
        if es_objeto:
            # Se sigue evaluando aunque no valide: el reporte muestra todos los motivos juntos.
            m, d, proporcion = validar_instrumentacion(traza, registro)
            motivos.extend(m)
            detalle.extend(d)
            tarea = extraer(traza, identidad['tarea'])
            if huellas is not None and isinstance(tarea, str):
                esperada = huellas.get(tarea)
                if esperada is not None:
                    huella_coincide = extraer(traza, reglas_estado['huella']) == esperada
                    if not huella_coincide:
                        motivos.append(MOTIVO_ESTADO_INICIAL)
                        detalle.append(f'huella de estado distinta de la esperada para {tarea}')
            if isinstance(tarea, str):
                campos_de_tarea = lector_tareas.campos(tarea)
                if campos_de_tarea is None:
                    motivos.append(MOTIVO_TAREA_DESCONOCIDA)
                    detalle.append(f'no existe la definicion {tarea}.yaml')
            if not motivos:
                clave = tuple(extraer(traza, identidad[n]) for n in ('tarea', 'arquitectura', 'repeticion'))
                if extraer(traza, registro.campo_estado_final) not in estados_reejecutables:
                    if clave in claves_validas:
                        motivos.append(MOTIVO_DUPLICADA)
                        detalle.append(f'ya hay un intento valido para {clave}')
                    else:
                        claves_validas.add(clave)

        run_id = extraer(traza, identidad['ejecucion']) if es_objeto else None
        fila_intento = {
            registro.columna_identidad(n): _texto(extraer(traza, c) if es_objeto else None)
            for n, c in identidad.items()
        }
        fila_intento[registro.columna_estado_final] = _texto(
            extraer(traza, registro.campo_estado_final) if es_objeto else None
        )
        fila_intento[COLUMNA_VALIDA] = not motivos
        fila_intento[COLUMNA_MOTIVOS] = SEPARADOR_MOTIVOS.join(motivos)
        fila_intento[COLUMNA_ORIGEN] = origen
        fila_intento[COLUMNA_HUELLA_COINCIDE] = huella_coincide
        fila_intento[COLUMNA_PROPORCION_RESIDUO] = proporcion
        intentos.append(fila_intento)

        if motivos:
            rechazos.append(Rechazo(origen, _texto(run_id), tuple(motivos), tuple(detalle)))
            return
        assert es_objeto and campos_de_tarea is not None
        fila = {columna(ARTEFACTO_TRAZA, c): extraer(traza, c) for c in campos_traza}
        fila.update(campos_de_tarea)
        fila[COLUMNA_ORIGEN] = origen
        fila[COLUMNA_HUELLA_COINCIDE] = huella_coincide
        fila[COLUMNA_PROPORCION_RESIDUO] = proporcion
        validas.append(fila)
        if proporcion is not None and proporcion > registro.validaciones['residuo_orquestacion']['aviso_proporcion']:
            avisos.append(AvisoResiduo(str(run_id), proporcion))

    for origen, traza, error in leer_jsonl(ruta_trazas):
        if error is not None:
            evaluar(origen, None, [MOTIVO_JSON_MALFORMADO], [error])
        else:
            evaluar(origen, traza, [], [])

    for origen, traza, detalle in _leer_cuarentena(registro, directorio_corrida):
        # Ya fue rechazada antes de persistir: se cuenta como intento, nunca como valida.
        evaluar_cuarentena(
            origen, traza, [MOTIVO_ESQUEMA_INVALIDO], detalle, registro, identidad, intentos, rechazos
        )

    columnas_validas = [
        *(columna(ARTEFACTO_TRAZA, c) for c in campos_traza),
        *(columna(ARTEFACTO_TAREAS, c) for c in campos_tareas),
        COLUMNA_ORIGEN,
        COLUMNA_HUELLA_COINCIDE,
        COLUMNA_PROPORCION_RESIDUO,
    ]
    ejecuciones = pd.DataFrame(validas, columns=columnas_validas)
    ejecuciones = _unir_por_ejecucion(ejecuciones, registro, directorio_corrida)
    orden = [registro.columna_identidad(n) for n in ('tarea', 'arquitectura', 'repeticion')]
    ejecuciones = ejecuciones.sort_values([*orden, COLUMNA_ORIGEN], kind='stable').reset_index(drop=True)

    tabla_intentos = pd.DataFrame(intentos)
    tabla_intentos = tabla_intentos.sort_values(
        [*orden, COLUMNA_ORIGEN], kind='stable', na_position='last'
    ).reset_index(drop=True)

    insumos = {nombre: cargar_insumo(registro, nombre, directorio_corrida) for nombre in INSUMOS}
    return Consolidado(ejecuciones, tabla_intentos, tuple(rechazos), tuple(avisos), insumos)


def evaluar_cuarentena(
    origen: str,
    traza: Any,
    motivos: list[str],
    detalle: list[str],
    registro: Registro,
    identidad: Mapping[str, str],
    intentos: list[dict[str, Any]],
    rechazos: list[Rechazo],
) -> None:
    """Registra un sobre de cuarentena como intento invalido."""
    es_objeto = isinstance(traza, Mapping)
    fila = {
        registro.columna_identidad(n): _texto(extraer(traza, c) if es_objeto else None)
        for n, c in identidad.items()
    }
    fila[registro.columna_estado_final] = _texto(
        extraer(traza, registro.campo_estado_final) if es_objeto else None
    )
    fila[COLUMNA_VALIDA] = False
    fila[COLUMNA_MOTIVOS] = SEPARADOR_MOTIVOS.join(motivos)
    fila[COLUMNA_ORIGEN] = origen
    fila[COLUMNA_HUELLA_COINCIDE] = None
    fila[COLUMNA_PROPORCION_RESIDUO] = None
    intentos.append(fila)
    run_id = extraer(traza, identidad['ejecucion']) if es_objeto else None
    rechazos.append(Rechazo(origen, _texto(run_id), tuple(motivos), tuple(detalle)))


def _unir_por_ejecucion(
    ejecuciones: pd.DataFrame, registro: Registro, directorio_corrida: Path
) -> pd.DataFrame:
    """Une puntuaciones (y futuros artefactos por ejecucion) por su clave declarada."""
    columna_ejecucion = registro.columna_identidad('ejecucion')
    for nombre in ARTEFACTOS_POR_EJECUCION:
        campos = registro.campos_de_artefacto(nombre)
        if not campos:
            continue
        datos = cargar_insumo(registro, nombre, directorio_corrida)
        if datos is None:
            # Sin el artefacto no se crean columnas: las metricas que lo usan quedan sin datos.
            continue
        clave = registro.artefactos[nombre]['clave']
        tabla = pd.DataFrame(
            [{clave: extraer(d, clave), **{columna(nombre, c): extraer(d, c) for c in campos}} for d in datos],
            columns=[clave, *(columna(nombre, c) for c in campos)],
        )
        repetidas = tabla[tabla[clave].duplicated()][clave].tolist()
        if repetidas:
            raise ErrorInsumo(f'{nombre}: clave repetida {repetidas[:3]}')
        ejecuciones = ejecuciones.merge(
            tabla, how='left', left_on=columna_ejecucion, right_on=clave, validate='one_to_one'
        ).drop(columns=[clave])
    return ejecuciones


def escribir_parquet(consolidado: Consolidado, directorio: Path) -> tuple[Path, Path]:
    """Conjunto oficial (solo validas) y registro de intentos, en Parquet."""
    directorio.mkdir(parents=True, exist_ok=True)
    ruta_ejecuciones = directorio / ARCHIVO_EJECUCIONES
    ruta_intentos = directorio / ARCHIVO_INTENTOS
    consolidado.ejecuciones.to_parquet(ruta_ejecuciones, index=False, engine='pyarrow')
    consolidado.intentos.to_parquet(ruta_intentos, index=False, engine='pyarrow')
    return ruta_ejecuciones, ruta_intentos


def leer_parquet(directorio: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Relee el conjunto consolidado: las metricas se calculan desde aqui, no desde memoria."""
    return (
        pd.read_parquet(directorio / ARCHIVO_EJECUCIONES, engine='pyarrow'),
        pd.read_parquet(directorio / ARCHIVO_INTENTOS, engine='pyarrow'),
    )
