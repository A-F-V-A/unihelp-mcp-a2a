"""Salidas del analisis: `resultados.json`, tablas y figuras con etiqueta.

`resultados.json` es el UNICO contrato con el panel de visualizacion
(`schemas/resultados.schema.json`). Reglas que se garantizan aqui:

- Una metrica de resultado abierto NO lleva ningun indicador de aprobado/reprobado:
  fijarle una expectativa prejuzgaria lo que el experimento quiere averiguar (HU-MET-03).
- El tamano de muestra que se reporta para inferencia es el numero de TAREAS.
- Dos ejecuciones sobre los mismos datos producen archivos identicos salvo `generado_en`:
  claves ordenadas, flotantes redondeados y SVG sin fecha ni identificadores aleatorios.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import matplotlib
import pandas as pd
from jsonschema import Draft202012Validator, FormatChecker

from .carga import COLUMNA_MOTIVOS, COLUMNA_VALIDA, SEPARADOR_MOTIVOS, AvisoResiduo, Rechazo
from .familias.comun import Contexto, Contraste, Fila, ResultadoMetrica, evaluar_umbral
from .inferencia import Intervalo
from .registro import ARTEFACTO_TRAZA, Registro, columna, leer_esquema

VERSION_ESQUEMA_RESULTADOS = '1.0.0'
ARCHIVO_RESULTADOS = 'resultados.json'
ARCHIVO_MANIFIESTO = 'manifiesto.json'
DECIMALES = 6
ETIQUETA_PUBLICABLE = re.compile(r'^(tabla|figura)_[0-9]+$')
CAMPOS_UMBRAL = ('operador', 'valor', 'arquitecturas', 'alcance', 'descripcion', 'consecuencia')


def redondear(valor: Any) -> float | None:
    """Redondeo fijo: evita que el ruido de coma flotante cambie los archivos entre corridas."""
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return None
    redondeado = round(float(valor), DECIMALES)
    return 0.0 if redondeado == 0 else redondeado


def _intervalo_json(intervalo: Intervalo | None) -> dict[str, float] | None:
    if intervalo is None:
        return None
    return {
        'inferior': redondear(intervalo.inferior),
        'superior': redondear(intervalo.superior),
        'nivel': intervalo.nivel,
    }


def _fila_json(fila: Fila) -> dict[str, Any]:
    return {
        'arquitectura': fila.arquitectura,
        'dimensiones': dict(fila.dimensiones),
        'estadistico': fila.estadistico,
        'valor': redondear(fila.valor),
        'intervalo': _intervalo_json(fila.intervalo),
        'n_tareas': fila.n_tareas,
        'n_observaciones': fila.n_observaciones,
    }


def _contraste_json(contraste: Contraste) -> dict[str, Any]:
    return {
        'minuendo': contraste.minuendo,
        'sustraendo': contraste.sustraendo,
        'dimensiones': dict(contraste.dimensiones),
        'estadistico': contraste.estadistico,
        'diferencia': redondear(contraste.estimacion.valor),
        'intervalo': _intervalo_json(contraste.estimacion.intervalo),
        'n_tareas': contraste.estimacion.n_tareas,
    }


def _observado_json(observado: Any) -> Any:
    if isinstance(observado, Mapping):
        return {k: redondear(v) for k, v in observado.items()}
    return redondear(observado)


def _procedencia_unica(ctx: Contexto, nombre: str) -> Any:
    col = columna(ARTEFACTO_TRAZA, ctx.registro.campo_procedencia(nombre))
    if ctx.ejecuciones.empty or col not in ctx.ejecuciones.columns:
        return None
    valores = sorted({v.item() if hasattr(v, 'item') else v for v in ctx.ejecuciones[col].dropna()}, key=str)
    if len(valores) > 1:
        raise ValueError(f'Las trazas mezclan corridas distintas: {nombre} toma los valores {valores}')
    return valores[0] if valores else None


def _corrida_json(ctx: Contexto) -> dict[str, Any]:
    registro = ctx.registro
    intentos = ctx.intentos
    por_motivo: dict[str, int] = {}
    for motivos in intentos.loc[~intentos[COLUMNA_VALIDA].astype(bool), COLUMNA_MOTIVOS]:
        for motivo in filter(None, str(motivos).split(SEPARADOR_MOTIVOS)):
            por_motivo[motivo] = por_motivo.get(motivo, 0) + 1
    tareas = ctx.ejecuciones[ctx.col_tarea].nunique() if not ctx.ejecuciones.empty else 0
    categoria_de = ctx.categorias_por_tarea()
    por_categoria = {c: sum(1 for v in categoria_de.values() if v == c) for c in registro.categorias}
    esquema_traza = registro.esquema_artefacto(ARTEFACTO_TRAZA) or {}
    validas = int(intentos[COLUMNA_VALIDA].astype(bool).sum())
    return {
        'semilla': _procedencia_unica(ctx, 'semilla'),
        'version_codigo': _procedencia_unica(ctx, 'version_codigo'),
        'modelo_id': _procedencia_unica(ctx, 'modelo_id'),
        'version_registro': registro.version,
        # La version se lee del `$id` (urn:...:traza:1.0.0); una prueba verifica que coincide.
        'version_esquema_traza': esquema_traza['$id'].rsplit(':', 1)[-1],
        'arquitecturas': list(registro.arquitecturas),
        'tareas': {'total': int(tareas), 'por_categoria': por_categoria},
        'ejecuciones': {
            'intentadas': len(intentos),
            'validas': validas,
            'invalidas': len(intentos) - validas,
            'por_motivo': dict(sorted(por_motivo.items())),
        },
        'inferencia': {
            'unidad': 'tarea',
            'tamano_muestra': int(tareas),
            'metodo': registro.inferencia['metodo'],
            'replicas': ctx.configuracion.replicas,
            'nivel': ctx.configuracion.nivel,
            'semilla': ctx.configuracion.semilla,
        },
    }


def construir_resultados(
    ctx: Contexto,
    resultados: Mapping[str, ResultadoMetrica],
    rechazos: tuple[Rechazo, ...],
    avisos: tuple[AvisoResiduo, ...],
    *,
    generado_en: str,
) -> dict[str, Any]:
    """Arma y valida el documento de resultados. Falla si no cumple su esquema."""
    registro: Registro = ctx.registro
    metricas = []
    for metrica in registro.metricas:
        datos = metrica.datos
        entrada: dict[str, Any] = {
            'codigo': metrica.codigo,
            'familia': metrica.familia,
            'nombre': datos['nombre'],
            'rol': metrica.rol,
            'hipotesis': list(datos['hipotesis']),
            'tipo_valor_esperado': metrica.tipo_valor_esperado,
            'unidad': datos['unidad_y_direccion']['unidad'],
            'direccion': datos['unidad_y_direccion']['direccion'],
            'unidad_analisis': datos['unidad_analisis'],
        }
        resultado = resultados.get(metrica.codigo)
        if resultado is None:
            entrada.update(
                estado='pendiente',
                motivo_estado=metrica.implementacion.get('bloqueada_por'),
                filas=[],
                contrastes=[],
                notas=[],
            )
        else:
            entrada.update(
                estado=resultado.estado,
                motivo_estado=resultado.motivo_estado,
                filas=[_fila_json(f) for f in resultado.filas],
                contrastes=[_contraste_json(c) for c in resultado.contrastes],
                notas=list(resultado.notas),
            )
        # El indicador de umbral existe SOLO para metricas de tipo umbral.
        if metrica.tipo_valor_esperado == 'umbral':
            umbral = metrica.valor_umbral or {}
            calculada = resultado is not None and resultado.estado == 'calculada'
            observado = resultado.observado_umbral if calculada else None
            entrada['umbral'] = {
                **{k: umbral[k] for k in CAMPOS_UMBRAL if k in umbral},
                'observado': _observado_json(observado),
                'alcanza': evaluar_umbral(umbral, observado) if calculada else None,
            }
        metricas.append(entrada)

    documento = {
        'version_esquema_resultados': VERSION_ESQUEMA_RESULTADOS,
        'generado_en': generado_en,
        'corrida': _corrida_json(ctx),
        'validacion': {
            'umbral_aviso_residuo': registro.validaciones['residuo_orquestacion']['aviso_proporcion'],
            'avisos_residuo': [{'ejecucion': a.run_id, 'proporcion': redondear(a.proporcion)} for a in avisos],
            'rechazos': [
                {'origen': r.origen, 'ejecucion': r.run_id, 'motivos': list(r.motivos), 'detalle': list(r.detalle)}
                for r in rechazos
            ],
        },
        'metricas': metricas,
    }
    validar_resultados(documento)
    return documento


def validar_resultados(documento: Mapping[str, Any]) -> None:
    validador = Draft202012Validator(leer_esquema('schemas/resultados.schema.json'), format_checker=FormatChecker())
    errores = sorted(
        f'{"/".join(map(str, e.absolute_path)) or "(raiz)"}: {e.message}' for e in validador.iter_errors(documento)
    )
    if errores:
        raise ValueError('resultados.json no cumple su esquema:\n  ' + '\n  '.join(errores[:20]))


def serializar(documento: Mapping[str, Any]) -> str:
    return json.dumps(documento, ensure_ascii=False, indent=2, sort_keys=True) + '\n'


def huella_sin_marca_tiempo(documento: Mapping[str, Any]) -> str:
    """SHA-256 del documento sin `generado_en`: igual en dos ejecuciones sobre los mismos datos."""
    sin_marca = {k: v for k, v in documento.items() if k != 'generado_en'}
    return hashlib.sha256(serializar(sin_marca).encode('utf-8')).hexdigest()


def filas_como_tabla(resultado: ResultadoMetrica) -> pd.DataFrame:
    """Filas de una metrica como tabla plana (una columna por dimension)."""
    registros = []
    for fila in resultado.filas:
        registros.append(
            {
                'arquitectura': fila.arquitectura,
                **dict(fila.dimensiones),
                'estadistico': fila.estadistico,
                'valor': redondear(fila.valor),
                'ic_inferior': None if fila.intervalo is None else redondear(fila.intervalo.inferior),
                'ic_superior': None if fila.intervalo is None else redondear(fila.intervalo.superior),
                'n_tareas': fila.n_tareas,
                'n_observaciones': fila.n_observaciones,
            }
        )
    return pd.DataFrame(registros)


class Publicador:
    """Escribe cada salida publicable con su etiqueta y la anota en el manifiesto.

    La etiqueta (`tabla_2`, `figura_1`) es la misma que lleva la celda del cuaderno que la
    genera: cada salida del manuscrito se rastrea hasta su celda (HU-MET-04).
    """

    def __init__(self, directorio: Path) -> None:
        self.directorio = directorio
        self.directorio.mkdir(parents=True, exist_ok=True)
        self._publicados: dict[str, Path] = {}

    def _ruta(self, etiqueta: str, extension: str) -> Path:
        if not ETIQUETA_PUBLICABLE.match(etiqueta):
            raise ValueError(f'Etiqueta "{etiqueta}" invalida: use tabla_N o figura_N')
        if etiqueta in self._publicados:
            raise ValueError(f'La etiqueta {etiqueta} ya se publico en esta ejecucion')
        ruta = self.directorio / f'{etiqueta}.{extension}'
        self._publicados[etiqueta] = ruta
        return ruta

    def tabla(self, etiqueta: str, tabla: pd.DataFrame) -> Path:
        ruta = self._ruta(etiqueta, 'csv')
        redondeada = tabla.map(lambda v: redondear(v) if isinstance(v, float) else v)
        redondeada.to_csv(ruta, index=False, lineterminator='\n', encoding='utf-8')
        return ruta

    def figura(self, etiqueta: str, figura: Any) -> Path:
        ruta = self._ruta(etiqueta, 'svg')
        # Sin estos dos ajustes el SVG cambia en cada ejecucion (fecha e identificadores aleatorios).
        with matplotlib.rc_context({'svg.hashsalt': etiqueta}):
            figura.savefig(ruta, format='svg', metadata={'Date': None})
        return ruta

    def resultados(self, documento: Mapping[str, Any]) -> Path:
        ruta = self.directorio / ARCHIVO_RESULTADOS
        ruta.write_text(serializar(documento), encoding='utf-8', newline='\n')
        return ruta

    def manifiesto(self, documento: Mapping[str, Any]) -> Path:
        """Etiqueta, archivo y SHA-256 de cada salida. No lleva marca de tiempo."""
        contenido = {
            'salidas': [
                {
                    'etiqueta': etiqueta,
                    'archivo': ruta.name,
                    'sha256': hashlib.sha256(ruta.read_bytes()).hexdigest(),
                }
                for etiqueta, ruta in sorted(self._publicados.items())
            ],
            'resultados': {
                'archivo': ARCHIVO_RESULTADOS,
                'sha256_sin_marca_tiempo': huella_sin_marca_tiempo(documento),
            },
        }
        ruta = self.directorio / ARCHIVO_MANIFIESTO
        ruta.write_text(serializar(contenido), encoding='utf-8', newline='\n')
        return ruta
