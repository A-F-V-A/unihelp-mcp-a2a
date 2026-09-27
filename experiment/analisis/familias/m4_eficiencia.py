"""Familia M4 · Eficiencia y costo (plan de medicion, seccion 8).

Todas las metricas por ejecucion se agregan con mediana por tarea y mediana entre
tareas: la latencia y el consumo tienen cola larga. La latencia solo usa ejecuciones
terminadas (D8); el consumo incluye lo gastado por las que fallaron (seccion 13).
"""

from __future__ import annotations

import numpy as np

from ..registro import Metrica
from .comun import (
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
    valores_por_arquitectura,
)

# Alias de la ficha M4.2 en el orden en que se apilan.
COMPONENTES_LATENCIA = ('modelo', 'herramienta', 'transporte', 'orquestacion')
DIMENSION_PROPORCION_RESIDUO = 'proporcion_orquestacion'


def _mediana_por_tarea(
    metrica: Metrica,
    ctx: Contexto,
    columna_valor: str,
    datos,
    *,
    dimensiones: dict[str, str] | None = None,
    contrastes: bool = True,
):
    matriz = matriz_tareas(ctx, por_tarea(ctx, datos, columna_valor, metrica.agregacion_tareas or ''))
    estimaciones = estimar(ctx, metrica, matriz)
    filas = filas_desde_estimaciones(
        estimaciones,
        nombre_estadistico(metrica),
        dimensiones=dimensiones,
        n_observaciones=conteo_por_arquitectura(ctx, datos),
    )
    pares = contrastes_pareados(ctx, metrica, matriz, dimensiones=dimensiones) if contrastes else []
    return estimaciones, filas, pares


@implementa('M4.1')
def latencia_extremo_a_extremo(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos = poblacion(metrica, ctx)
    if datos.empty:
        return sin_datos(metrica, 'No hay ejecuciones terminadas.')
    columna_latencia = metrica.columna('latencia')
    _, filas, contrastes = _mediana_por_tarea(metrica, ctx, columna_latencia, datos)
    # p95 y rango intercuartilico describen la distribucion de ejecuciones; no son inferenciales.
    for arquitectura in ctx.registro.arquitecturas:
        valores = datos.loc[datos[ctx.col_arquitectura] == arquitectura, columna_latencia].to_numpy(float)
        if valores.size == 0:
            continue
        q25, q75, p95 = np.percentile(valores, [25, 75, 95])
        filas.append(Fila(arquitectura, 'p95_ejecuciones', float(p95), n_observaciones=int(valores.size)))
        filas.append(
            Fila(arquitectura, 'rango_intercuartilico_ejecuciones', float(q75 - q25), n_observaciones=int(valores.size))
        )
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes))


@implementa('M4.2')
def descomposicion_latencia(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos = poblacion(metrica, ctx)
    if datos.empty:
        return sin_datos(metrica, 'No hay ejecuciones terminadas.')
    filas: list[Fila] = []
    contrastes = []
    for componente in COMPONENTES_LATENCIA:
        _, filas_componente, pares = _mediana_por_tarea(
            metrica, ctx, metrica.columna(componente), datos, dimensiones={'componente': componente}
        )
        filas += filas_componente
        contrastes += pares
    total = datos[metrica.columna('total')].astype(float)
    datos['_proporcion_residuo'] = (datos[metrica.columna('orquestacion')] / total).where(total > 0)
    _, filas_residuo, _ = _mediana_por_tarea(
        metrica,
        ctx,
        '_proporcion_residuo',
        datos,
        dimensiones={'componente': DIMENSION_PROPORCION_RESIDUO},
        contrastes=False,
    )
    filas += filas_residuo
    return ResultadoMetrica(
        metrica.codigo,
        'calculada',
        tuple(filas),
        tuple(contrastes),
        observado_umbral=valores_por_arquitectura(filas_residuo),
        notas=('La mediana de cada componente no suma la mediana total: las medianas no son aditivas.',),
    )


@implementa('M4.3')
def piso_latencia_transporte(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    bench = ctx.insumos.get('bench_transporte')
    if bench is None:
        return sin_datos(metrica, 'La corrida no trae el microbenchmark de transporte.')
    calentamiento = int(bench[metrica.campo('calentamiento')])
    percentiles = metrica.parametro('percentiles')
    minimo = int(metrica.parametro('iteraciones_minimas'))
    filas: list[Fila] = []
    notas: list[str] = []
    for transporte in bench[metrica.campo('transportes')]:
        nombre = transporte[metrica.subcampo('nombre')]
        muestras = np.asarray(transporte[metrica.subcampo('latencias')], dtype=float)[calentamiento:]
        dimensiones = {'transporte': nombre}
        if muestras.size < minimo:
            notas.append(f'{nombre}: {muestras.size} iteraciones medidas, menos de las {minimo} exigidas.')
        if muestras.size == 0:
            continue
        for p, valor in zip(percentiles, np.percentile(muestras, percentiles), strict=True):
            filas.append(Fila(None, f'p{p}', float(valor), dimensiones, n_observaciones=int(muestras.size)))
        desviacion = float(np.std(muestras, ddof=1)) if muestras.size > 1 else None
        filas.append(Fila(None, 'desviacion_estandar', desviacion, dimensiones, n_observaciones=int(muestras.size)))
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), notas=tuple(notas))


def _conteo_por_ejecucion(metrica: Metrica, ctx: Contexto, alias: str) -> tuple[ResultadoMetrica, list[Fila]]:
    datos = poblacion(metrica, ctx)
    if datos.empty:
        return sin_datos(metrica, 'No hay ejecuciones que entren al calculo de costo.'), []
    _, filas, contrastes = _mediana_por_tarea(
        metrica, ctx, metrica.columna(alias), datos, contrastes=metrica.con_contrastes
    )
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes)), filas


@implementa('M4.4')
def llamadas_modelo(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    return _conteo_por_ejecucion(metrica, ctx, 'llamadas_modelo')[0]


@implementa('M4.5')
def mensajes_entre_agentes(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    resultado, filas = _conteo_por_ejecucion(metrica, ctx, 'mensajes')
    if resultado.estado != 'calculada':
        return resultado
    return ResultadoMetrica(
        resultado.codigo,
        resultado.estado,
        resultado.filas,
        resultado.contrastes,
        observado_umbral=valores_por_arquitectura(filas),
    )


@implementa('M4.6')
def tokens_por_ejecucion(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos = poblacion(metrica, ctx)
    if datos.empty:
        return sin_datos(metrica, 'No hay ejecuciones que entren al calculo de costo.')
    entrada = metrica.columna('entrada')
    salida = metrica.columna('salida')
    datos['_tokens_total'] = datos[entrada] + datos[salida]
    filas: list[Fila] = []
    contrastes = []
    for dimension, columna_tokens, con_contrastes in (
        ('total', '_tokens_total', True),
        ('entrada', entrada, False),
        ('salida', salida, False),
    ):
        _, filas_tokens, pares = _mediana_por_tarea(
            metrica, ctx, columna_tokens, datos, dimensiones={'tokens': dimension}, contrastes=con_contrastes
        )
        filas += filas_tokens
        contrastes += pares
    for arquitectura, n in conteo_por_arquitectura(ctx, datos).items():
        suma = datos.loc[datos[ctx.col_arquitectura] == arquitectura, '_tokens_total'].sum()
        filas.append(Fila(arquitectura, 'suma_corrida', float(suma), {'tokens': 'total'}, n_observaciones=n))
    filas.append(
        Fila(None, 'suma_corrida', float(datos['_tokens_total'].sum()), {'tokens': 'total'}, n_observaciones=len(datos))
    )
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes))


@implementa('M4.7')
def costo_estimado(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    """Costo por ejecucion = tokens de la traza x tarifa de lista del modelo (decision 50).

    `usage.input_tokens` ya incluye los servidos desde cache, que se cobran a su propia tarifa.
    """
    datos = poblacion(metrica, ctx)
    if datos.empty:
        return sin_datos(metrica, 'No hay ejecuciones que entren al calculo de costo.')
    tarifas = ctx.insumos.get('tarifas')
    if tarifas is None:
        return sin_datos(metrica, 'No hay tabla de tarifas (experiment/tarifas.yaml).')
    tabla = tarifas[metrica.campo('modelos', 'tarifas')]
    modelos = datos[metrica.columna('modelo')].astype(str)
    sin_tarifa = sorted(set(modelos) - set(tabla))
    datos = datos[modelos.isin(tabla)].copy()
    if datos.empty:
        return sin_datos(metrica, f'La tabla de tarifas no tiene el modelo {", ".join(sin_tarifa)}.')
    entrada = datos[metrica.columna('entrada')].astype(float)
    cacheados = datos[metrica.columna('cacheados')].fillna(0).astype(float).clip(upper=entrada)
    salida = datos[metrica.columna('salida')].astype(float)
    precio = {campo: datos[metrica.columna('modelo')].map(lambda m, c=campo: float(tabla[m][c]))
              for campo in metrica.parametro('campos_tarifa')}
    entrada_p, cache_p, salida_p = (precio[c] for c in metrica.parametro('campos_tarifa'))
    datos['_costo_usd'] = ((entrada - cacheados) * entrada_p + cacheados * cache_p + salida * salida_p) / 1e6
    solicitudes = int(metrica.parametro('proyeccion_solicitudes'))
    estimaciones, filas, contrastes = _mediana_por_tarea(
        metrica, ctx, '_costo_usd', datos, contrastes=metrica.con_contrastes
    )
    filas += filas_desde_estimaciones(
        estimaciones,
        f'proyeccion_{solicitudes}_solicitudes',
        n_observaciones=conteo_por_arquitectura(ctx, datos),
        escala=float(solicitudes),
    )
    for arquitectura, n in conteo_por_arquitectura(ctx, datos).items():
        suma = datos.loc[datos[ctx.col_arquitectura] == arquitectura, '_costo_usd'].sum()
        filas.append(Fila(arquitectura, 'suma_corrida', float(suma), n_observaciones=n))
    filas.append(Fila(None, 'suma_corrida', float(datos['_costo_usd'].sum()), n_observaciones=len(datos)))
    usadas = '; '.join(
        f'{m}: {tabla[m][entrada_c]} / {tabla[m][cache_c]} / {tabla[m][salida_c]} USD por millon '
        f'(entrada / entrada en cache / salida), fuente {tabla[m].get("fuente", "?")}'
        for m in sorted(set(datos[metrica.columna('modelo')].astype(str)))
        for entrada_c, cache_c, salida_c in [tuple(metrica.parametro('campos_tarifa'))]
    )
    notas = [f'Tarifa de lista consultada el {tarifas.get("consultado_el")}: {usadas}.',
             'El costo depende de la tarifa vigente; el dato robusto es M4.6.']
    if sin_tarifa:
        notas.append(f'Sin tarifa, excluidas del costo: {", ".join(sin_tarifa)}.')
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes), notas=tuple(notas))
