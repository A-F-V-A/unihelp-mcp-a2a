"""Familia M1 · Efectividad (plan de medicion, seccion 5).

`exito(t,r,a)` sale de las puntuaciones (compuerta automatica + juez). La tabla de
estados finales manda sobre la puntuacion: un estado que cuenta como fallo vale 0
aunque la puntuacion diga lo contrario.
"""

from __future__ import annotations

import pandas as pd

from ..registro import Metrica
from .comun import (
    ALIAS_ESTADO_FINAL,
    Contexto,
    Fila,
    ResultadoMetrica,
    conteo_por_arquitectura,
    contrastes_pareados,
    estimar,
    filas_desde_estimaciones,
    implementa,
    matriz_tareas,
    nombre_estadistico,
    poblacion,
    por_tarea,
    sin_datos,
)

ALIAS_EXITO = 'exito'
COLUMNA_EXITO = '_exito_efectivo'


def _con_exito(metrica: Metrica, ctx: Contexto) -> tuple[pd.DataFrame | None, str | None]:
    """Poblacion de efectividad con `exito` ya resuelto, o el motivo por el que no se puede."""
    datos = poblacion(metrica, ctx)
    if datos.empty:
        return None, 'No hay ejecuciones que entren al calculo de efectividad.'
    columna_exito = metrica.columna(ALIAS_EXITO)
    if columna_exito not in datos.columns:
        return None, 'La corrida no trae puntuaciones (compuerta automatica + juez).'
    incluidas = datos[metrica.columna(ALIAS_ESTADO_FINAL)].isin(
        ctx.registro.estados_donde('efectividad', 'incluye')
    )
    exito = datos[columna_exito].astype('boolean')
    faltantes = datos.loc[incluidas & exito.isna(), ctx.col_ejecucion].tolist()
    if faltantes:
        # No se completa con ceros ni se descartan: eso cambiaria el denominador en silencio.
        return None, (
            f'{len(faltantes)} ejecuciones incluidas en efectividad no tienen puntuacion '
            f'(por ejemplo {faltantes[0]}).'
        )
    datos[COLUMNA_EXITO] = (incluidas & exito.fillna(False)).astype(float)
    return datos, None


@implementa('M1.1')
def tasa_exito(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos, motivo = _con_exito(metrica, ctx)
    if datos is None:
        return sin_datos(metrica, motivo or '')
    matriz = matriz_tareas(ctx, por_tarea(ctx, datos, COLUMNA_EXITO, metrica.agregacion_tareas or ''))
    filas = filas_desde_estimaciones(
        estimar(ctx, metrica, matriz),
        nombre_estadistico(metrica),
        n_observaciones=conteo_por_arquitectura(ctx, datos),
    )
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes_pareados(ctx, metrica, matriz)))


@implementa('M1.2')
def tasa_exito_por_categoria(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos, motivo = _con_exito(metrica, ctx)
    if datos is None:
        return sin_datos(metrica, motivo or '')
    matriz = matriz_tareas(ctx, por_tarea(ctx, datos, COLUMNA_EXITO, metrica.agregacion_tareas or ''))
    categoria_de = ctx.categorias_por_tarea()
    filas: list[Fila] = []
    contrastes = []
    notas = []
    for categoria in ctx.registro.categorias:
        tareas = [t for t in matriz.tareas if categoria_de.get(t) == categoria]
        dimensiones = {'categoria': categoria}
        if not tareas:
            notas.append(f'La categoria {categoria} no tiene tareas en esta corrida.')
            continue
        submatriz = matriz.seleccionar_tareas(tareas)
        de_categoria = datos[datos[ctx.col_tarea].isin(tareas)]
        filas += filas_desde_estimaciones(
            estimar(ctx, metrica, submatriz),
            nombre_estadistico(metrica),
            dimensiones=dimensiones,
            n_observaciones=conteo_por_arquitectura(ctx, de_categoria),
        )
        contrastes += contrastes_pareados(ctx, metrica, submatriz, dimensiones=dimensiones)
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes), notas=tuple(notas))


def _indicador_por_tarea(metrica: Metrica, ctx: Contexto, consistente: bool) -> ResultadoMetrica:
    datos, motivo = _con_exito(metrica, ctx)
    if datos is None:
        return sin_datos(metrica, motivo or '')
    resumen = (
        datos.groupby([ctx.col_tarea, ctx.col_arquitectura], sort=True)[COLUMNA_EXITO]
        .agg(['sum', 'count'])
        .reset_index()
    )
    # R es el numero de repeticiones que entran a efectividad en esa (tarea, arquitectura).
    if consistente:
        indicador = resumen['sum'] == resumen['count']
    else:
        indicador = (resumen['sum'] > 0) & (resumen['sum'] < resumen['count'])
    resumen[COLUMNA_EXITO] = indicador.astype(float)
    matriz = matriz_tareas(ctx, por_tarea(ctx, resumen, COLUMNA_EXITO, metrica.agregacion_tareas or ''))
    estimaciones = estimar(ctx, metrica, matriz)
    filas = filas_desde_estimaciones(
        estimaciones,
        nombre_estadistico(metrica),
        n_observaciones={a: e.n_tareas for a, e in estimaciones.items()},
    )
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas))


def distribucion_exitos(metrica: Metrica, ctx: Contexto) -> pd.DataFrame | None:
    """Exitos y repeticiones por (tarea, arquitectura): la base de M1.3, M1.4 y la figura 3."""
    datos, _ = _con_exito(metrica, ctx)
    if datos is None:
        return None
    return (
        datos.groupby([ctx.col_tarea, ctx.col_arquitectura], sort=True)[COLUMNA_EXITO]
        .agg(exitos='sum', repeticiones='count')
        .reset_index()
        .rename(columns={ctx.col_tarea: 'tarea', ctx.col_arquitectura: 'arquitectura'})
    )


@implementa('M1.3')
def exito_consistente(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    return _indicador_por_tarea(metrica, ctx, consistente=True)


@implementa('M1.4')
def resultado_mixto(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    return _indicador_por_tarea(metrica, ctx, consistente=False)


@implementa('M1.5')
def fallos_por_tipo(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos, motivo = _con_exito(metrica, ctx)
    if datos is None:
        return sin_datos(metrica, motivo or '')
    estados_fallo = ctx.registro.estados_donde('efectividad', 'fallo')
    etiqueta_rubrica = metrica.parametro('etiqueta_fallo_rubrica')
    tipos = (*estados_fallo, etiqueta_rubrica)
    fallidas = datos[datos[COLUMNA_EXITO] == 0].copy()
    estado = fallidas[metrica.columna(ALIAS_ESTADO_FINAL)]
    fallidas['_tipo'] = estado.where(estado.isin(estados_fallo), etiqueta_rubrica)
    poblacion_por_arquitectura = conteo_por_arquitectura(ctx, datos)
    filas: list[Fila] = []
    for arquitectura in ctx.registro.arquitecturas:
        de_arquitectura = fallidas[fallidas[ctx.col_arquitectura] == arquitectura]
        total_fallos = len(de_arquitectura)
        for tipo in tipos:
            n = int((de_arquitectura['_tipo'] == tipo).sum())
            dimensiones = {'tipo_fallo': tipo}
            filas.append(
                Fila(arquitectura, 'conteo', float(n), dimensiones,
                     n_observaciones=poblacion_por_arquitectura[arquitectura])
            )
            filas.append(
                Fila(arquitectura, 'proporcion_de_fallos', None if total_fallos == 0 else n / total_fallos,
                     dimensiones, n_observaciones=total_fallos)
            )
    return ResultadoMetrica(
        metrica.codigo,
        'calculada',
        tuple(filas),
        notas=('La causa raiz de un error de agente no se clasifica automaticamente.',),
    )
