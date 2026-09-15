"""Familia M7 · Fiabilidad del experimento (plan de medicion, seccion 11).

No responden ninguna hipotesis: deciden si las demas familias se pueden creer. Todas
son de tipo umbral. Las que dependen de un insumo que la corrida no trae (calificacion
humana, juez, reproduccion, corrida de control) quedan `sin_datos`, nunca en cero.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import cohen_kappa_score

from ..carga import COLUMNA_HUELLA_COINCIDE, leer_jsonl
from ..registro import ARTEFACTO_TRAZA, MARCA_ARREGLO, Metrica
from .comun import ALIAS_ESTADO_FINAL, Contexto, Fila, ResultadoMetrica, implementa, sin_datos


def _proporcion_global_y_por_arquitectura(
    ctx: Contexto, datos: pd.DataFrame, columna_indicador: str, estadistico: str = 'proporcion'
) -> tuple[list[Fila], float | None]:
    indicador = datos[columna_indicador].astype(float)
    global_ = None if indicador.empty else float(indicador.mean())
    filas = [Fila(None, estadistico, global_, n_observaciones=int(indicador.size))]
    for arquitectura in ctx.registro.arquitecturas:
        de_arquitectura = indicador[datos[ctx.col_arquitectura] == arquitectura]
        valor = None if de_arquitectura.empty else float(de_arquitectura.mean())
        filas.append(Fila(arquitectura, estadistico, valor, n_observaciones=int(de_arquitectura.size)))
    return filas, global_


@implementa('M7.1')
def completitud_trazas(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    intentos = ctx.intentos
    if intentos.empty:
        return sin_datos(metrica, 'La corrida no tiene intentos.')
    filas, global_ = _proporcion_global_y_por_arquitectura(ctx, intentos, metrica.columna('valida'))
    return ResultadoMetrica(
        metrica.codigo,
        'calculada',
        tuple(filas),
        observado_umbral=global_,
        notas=('Los intentos sin arquitectura legible solo cuentan en el valor global.',),
    )


@implementa('M7.2')
def integridad_estado_inicial(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    if ctx.insumos.get(ctx.registro.estado_inicial['artefacto']) is None:
        return sin_datos(metrica, 'La corrida no trae las huellas de estado esperadas.')
    verificados = ctx.intentos[ctx.intentos[COLUMNA_HUELLA_COINCIDE].notna()]
    if verificados.empty:
        return sin_datos(metrica, 'Ninguna tarea de la corrida tiene huella esperada.')
    filas, global_ = _proporcion_global_y_por_arquitectura(ctx, verificados, COLUMNA_HUELLA_COINCIDE)
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), observado_umbral=global_)


@implementa('M7.3')
def tasa_reejecucion(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    columna_estado = metrica.columna(ALIAS_ESTADO_FINAL)
    intentos = ctx.intentos[ctx.intentos[columna_estado].notna()].copy()
    if intentos.empty:
        return sin_datos(metrica, 'Ningun intento tiene estado final legible.')
    claves = [ctx.col_tarea, ctx.col_arquitectura, ctx.col_repeticion]
    intentos['_reejecutable'] = intentos[columna_estado].isin(ctx.registro.estados_reejecutables())
    por_ejecucion = intentos.groupby(claves, sort=True)['_reejecutable'].any().reset_index()
    filas, global_ = _proporcion_global_y_por_arquitectura(ctx, por_ejecucion, '_reejecutable')
    return ResultadoMetrica(
        metrica.codigo,
        'calculada',
        tuple(filas),
        observado_umbral=global_,
        notas=(
            'Se cuenta desde outcome del intento; el cruce con el registro de reejecuciones (reruns.md) '
            'queda pendiente hasta que exista el ejecutor.',
        ),
    )


def _kappa(a: Sequence[str], b: Sequence[str]) -> float | None:
    # Si ambos revisores usan una sola etiqueta, el acuerdo por azar es 1 y kappa no esta definido.
    if len(set(a) | set(b)) < 2:
        return None
    return float(cohen_kappa_score(list(a), list(b)))


@implementa('M7.4')
def acuerdo_revisores(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    planilla = ctx.insumos.get('calificacion_humana')
    if not planilla:
        return sin_datos(metrica, 'La corrida no trae la calificacion humana.')
    campo_a, campo_b = metrica.campo('revisor_a'), metrica.campo('revisor_b')
    campo_tarea = metrica.campo('tarea', 'calificacion_humana')
    notas: list[str] = []
    global_ = _kappa([r[campo_a] for r in planilla], [r[campo_b] for r in planilla])
    if global_ is None:
        notas.append('Kappa global no definido: los revisores usaron una sola etiqueta.')
    filas = [Fila(None, 'kappa_cohen', global_, n_observaciones=len(planilla))]
    categoria_de = ctx.categorias_por_tarea()
    for categoria in ctx.registro.categorias:
        filas_categoria = [r for r in planilla if categoria_de.get(r[campo_tarea]) == categoria]
        if not filas_categoria:
            continue
        kappa = _kappa([r[campo_a] for r in filas_categoria], [r[campo_b] for r in filas_categoria])
        if kappa is None:
            notas.append(f'Kappa no definido en {categoria}: una sola etiqueta.')
        filas.append(Fila(None, 'kappa_cohen', kappa, {'categoria': categoria}, n_observaciones=len(filas_categoria)))
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), observado_umbral=global_, notas=tuple(notas))


@implementa('M7.5')
def acuerdo_juez_humano(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    juez = ctx.insumos.get('veredictos_juez')
    planilla = ctx.insumos.get('calificacion_humana')
    if not juez or not planilla:
        return sin_datos(metrica, 'Faltan los veredictos del juez o la calificacion humana.')
    clave_juez = metrica.campo('ejecucion', 'veredictos_juez')
    clave_humana = metrica.campo('ejecucion', 'calificacion_humana')
    veredicto_juez = {r[clave_juez]: r[metrica.campo('veredicto')] for r in juez}
    arquitectura_de = dict(
        zip(ctx.intentos[ctx.col_ejecucion], ctx.intentos[ctx.col_arquitectura], strict=True)
    )
    filas_muestra = [
        {
            ctx.col_arquitectura: arquitectura_de.get(r[clave_humana]),
            '_coincide': veredicto_juez[r[clave_humana]] == r[metrica.campo('adjudicado')],
        }
        for r in planilla
        if r[clave_humana] in veredicto_juez
    ]
    faltantes = len(planilla) - len(filas_muestra)
    if not filas_muestra:
        return sin_datos(metrica, 'Ninguna ejecucion de la muestra tiene veredicto del juez.')
    filas, global_ = _proporcion_global_y_por_arquitectura(ctx, pd.DataFrame(filas_muestra), '_coincide')
    notas = [f'{faltantes} ejecuciones de la muestra no tienen veredicto del juez.'] if faltantes else []
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), observado_umbral=global_, notas=tuple(notas))


def _eliminar(nodo: Any, segmentos: Sequence[str]) -> None:
    if not segmentos or not isinstance(nodo, dict):
        return
    cabeza, *resto = segmentos
    nombre = cabeza.removesuffix(MARCA_ARREGLO)
    if nombre not in nodo:
        return
    if not resto:
        del nodo[nombre]
        return
    hijos = nodo[nombre] if cabeza.endswith(MARCA_ARREGLO) and isinstance(nodo[nombre], list) else [nodo[nombre]]
    for hijo in hijos:
        _eliminar(hijo, resto)


def huella_contenido(traza: Mapping[str, Any], campos_excluidos: Sequence[str]) -> str:
    """SHA-256 de la traza canonica sin los campos que legitimamente cambian al reproducir."""
    copia = json.loads(json.dumps(traza))
    for ruta in campos_excluidos:
        _eliminar(copia, ruta.split('.'))
    canonica = json.dumps(copia, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(canonica.encode('utf-8')).hexdigest()


@implementa('M7.6')
def determinismo_reproduccion(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    reproduccion = ctx.insumos.get('reproduccion')
    if reproduccion is None:
        return sin_datos(metrica, 'La corrida no trae la reproduccion desde casetes.')
    registro = ctx.registro
    excluidos = metrica.parametro('campos_excluidos')
    campos_clave = [registro.campo_identidad(n) for n in ('tarea', 'arquitectura', 'repeticion')]

    def clave(traza: Mapping[str, Any]) -> tuple[str, ...]:
        valores = []
        for ruta in campos_clave:
            valor: Any = traza
            for segmento in ruta.split('.'):
                valor = valor.get(segmento) if isinstance(valor, Mapping) else None
            valores.append(str(valor))
        return tuple(valores)

    # Solo se comparan las ejecuciones oficiales: validas y no reejecutables.
    oficiales = ctx.ejecuciones[
        ~ctx.ejecuciones[metrica.columna(ALIAS_ESTADO_FINAL, ARTEFACTO_TRAZA)].isin(registro.estados_reejecutables())
    ]
    ids_oficiales = set(oficiales[ctx.col_ejecucion])
    campo_ejecucion = registro.campo_identidad('ejecucion')
    ruta_trazas = registro.ruta_artefacto(ARTEFACTO_TRAZA, ctx.directorio_corrida)
    assert ruta_trazas is not None
    crudas = {
        doc[campo_ejecucion]: doc
        for _, doc, error in leer_jsonl(ruta_trazas)
        if error is None and isinstance(doc, Mapping) and doc.get(campo_ejecucion) in ids_oficiales
    }
    reproducidas = {clave(t): huella_contenido(t, excluidos) for t in reproduccion if isinstance(t, Mapping)}

    filas_comparacion = []
    distintas = []
    for run_id in sorted(crudas):
        traza = crudas[run_id]
        identica = reproducidas.get(clave(traza)) == huella_contenido(traza, excluidos)
        if not identica:
            distintas.append(run_id)
        filas_comparacion.append({ctx.col_arquitectura: clave(traza)[1], '_identica': identica})
    if not filas_comparacion:
        return sin_datos(metrica, 'No hay ejecuciones oficiales que comparar.')
    filas, global_ = _proporcion_global_y_por_arquitectura(ctx, pd.DataFrame(filas_comparacion), '_identica')
    notas = [f'No reproducen igual: {", ".join(distintas[:10])}'] if distintas else []
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), observado_umbral=global_, notas=tuple(notas))


@implementa('M7.7')
def sobrecosto_instrumentacion(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    control = ctx.insumos.get('control_instrumentacion')
    if not control:
        return sin_datos(metrica, 'La corrida no trae la corrida de control de instrumentacion.')
    tarea, modo, latencia = metrica.campo('tarea'), metrica.campo('modo'), metrica.campo('latencia')
    tabla = pd.DataFrame([{'tarea': r[tarea], 'modo': r[modo], 'latencia': float(r[latencia])} for r in control])
    medianas = tabla.pivot_table(index='tarea', columns='modo', values='latencia', aggfunc='median')
    completo, minimo = metrica.parametro('modo_completo'), metrica.parametro('modo_minimo')
    if completo not in medianas or minimo not in medianas:
        return sin_datos(metrica, 'La corrida de control no trae ambos modos de instrumentacion.')
    pareadas = medianas[[completo, minimo]].dropna()
    if pareadas.empty:
        return sin_datos(metrica, 'Ninguna tarea tiene ambos modos de instrumentacion.')
    # Diferencia pareada DENTRO de cada tarea; luego mediana entre tareas.
    delta = float(np.median(pareadas[completo] - pareadas[minimo]))
    base = float(np.median(pareadas[minimo]))
    proporcion = None if base == 0 else delta / base
    n_tareas = len(pareadas)
    filas = (
        Fila(None, 'mediana_diferencia_pareada_ms', delta, n_tareas=n_tareas, n_observaciones=len(tabla)),
        Fila(None, 'proporcion_sobre_latencia', proporcion, n_tareas=n_tareas, n_observaciones=len(tabla)),
    )
    return ResultadoMetrica(metrica.codigo, 'calculada', filas, observado_umbral=proporcion)
