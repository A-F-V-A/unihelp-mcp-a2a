"""Familia M3 · Calidad de la respuesta (plan de medicion, seccion 7).

Aqui viven las metricas de M3 que se verifican de forma mecanica contra la traza.
M3.2, M3.3 y M3.4 necesitan el juez y siguen pendientes.

M3.1 usa la misma nocion de «dato citado» que la verificacion 7 de la compuerta
(`ejecutor/compuerta.py`): se ignoran identificadores (codigos de politica, numeros
de ticket, prioridades) y marcadores de lista, y un dato cuenta como hallado si
aparece literalmente en algun resultado de herramienta de ESA ejecucion. A las
cifras se suman correos y enlaces, como pide la ficha (decision 51).
"""

from __future__ import annotations

import json
import re

import numpy as np
import pandas as pd

from ..registro import Metrica
from .comun import (
    Contexto,
    Fila,
    ResultadoMetrica,
    agregado_por_tarea,
    como_lista,
    como_objeto,
    implementa,
    normalizar_texto,
    poblacion,
    sin_datos,
    valores_por_arquitectura,
)

COLUMNA = '_valor_ejecucion'

PATRON_CODIGOS = re.compile(r'\b(?:POL-[A-Z]{2}-\d+|UH-\d{4}-\d+|UNI-\d{4}-\d+|P\d)\b')
PATRON_MARCADOR_LISTA = re.compile(r'^[ \t]*[-*]?[ \t]*\d+[.)](?=[ \t])', re.MULTILINE)
PATRON_ENLACE = re.compile(r'https?://[^\s)\]>»"]+', re.IGNORECASE)
PATRON_CORREO = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
PATRON_NUMERO = re.compile(r'\d+(?:[.,]\d+)?')


def datos_citados(respuesta: str) -> set[tuple[str, str]]:
    """(tipo, valor) de cada enlace, correo y cifra de la respuesta, sin identificadores."""
    enlaces = {('enlace', e.rstrip('.,;:')) for e in PATRON_ENLACE.findall(respuesta)}
    sin_enlaces = PATRON_ENLACE.sub(' ', respuesta)
    correos = {('correo', c.rstrip('.')) for c in PATRON_CORREO.findall(sin_enlaces)}
    resto = PATRON_CORREO.sub(' ', sin_enlaces)
    resto = PATRON_MARCADOR_LISTA.sub(' ', PATRON_CODIGOS.sub(' ', resto))
    cifras = {('cifra', n) for n in PATRON_NUMERO.findall(resto)}
    return enlaces | correos | cifras


def hallado(tipo: str, valor: str, recuperado: str, recuperado_min: str) -> bool:
    if tipo in ('enlace', 'correo'):
        return valor.casefold() in recuperado_min
    # Separador decimal o de miles: 3,5 = 3.5; 1.000 = 1000.
    variantes = {valor, valor.replace(',', '.'), valor.replace('.', '').replace(',', '')}
    return any(v and v in recuperado for v in variantes)


@implementa('M3.1')
def fidelidad_citacion(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos = poblacion(metrica, ctx)
    if datos.empty:
        return sin_datos(metrica, 'No hay ejecuciones que entren al calculo.')
    valores, citados_total, no_hallados = [], 0, 0
    for _, fila in datos.iterrows():
        respuesta = fila[metrica.columna('respuesta')]
        if not isinstance(respuesta, str) or not respuesta.strip():
            valores.append(np.nan)
            continue
        recuperado = ' '.join(
            json.dumps(r, ensure_ascii=False) for r in como_lista(fila[metrica.columna('resultados_herramienta')])
        )
        citados = datos_citados(respuesta)
        if not citados:
            # Sin datos citados no hay fidelidad que medir: fuera del denominador, no 1.
            valores.append(np.nan)
            continue
        hallados = sum(hallado(t, v, recuperado, recuperado.casefold()) for t, v in citados)
        citados_total += len(citados)
        no_hallados += len(citados) - hallados
        valores.append(hallados / len(citados))
    datos[COLUMNA] = pd.Series(valores, index=datos.index, dtype=float)
    if datos[COLUMNA].notna().sum() == 0:
        return sin_datos(metrica, 'Ninguna respuesta final cita cifras, correos ni enlaces.')
    _, filas, contrastes = agregado_por_tarea(metrica, ctx, datos, COLUMNA, contrastes=metrica.con_contrastes)
    for arquitectura in ctx.registro.arquitecturas:
        de_arq = datos[datos[ctx.col_arquitectura] == arquitectura]
        con_dato = de_arq[de_arq[COLUMNA].notna()]
        filas.append(Fila(arquitectura, 'ejecuciones_con_dato_no_hallado', float((con_dato[COLUMNA] < 1).sum()),
                          n_observaciones=len(con_dato)))
    return ResultadoMetrica(
        metrica.codigo, 'calculada', tuple(filas), tuple(contrastes),
        observado_umbral=valores_por_arquitectura([f for f in filas if f.estadistico.endswith('_entre_tareas')]),
        notas=(
            f'{citados_total} datos citados en total, {no_hallados} sin respaldo literal en los resultados de '
            'herramienta de su ejecucion. Una cifra no hallada puede ser una reformulacion legitima '
            '(por ejemplo «tres días» escrito como 3); la revision fina corresponde al juez.',
        ),
    )


def _exactitud(metrica: Metrica, ctx: Contexto, alias_obtenido: str, alias_esperado: str) -> pd.DataFrame | None:
    datos = poblacion(metrica, ctx)
    if datos.empty:
        return None

    def valor(fila: pd.Series) -> float:
        esperado = como_objeto(fila[metrica.columna(alias_esperado)])
        if esperado is None:
            return np.nan
        obtenido = como_objeto(fila[metrica.columna(alias_obtenido)])
        # Sin objeto final, o sin el campo, la ejecucion no acerto: no se descarta.
        return float(obtenido is not None and normalizar_texto(obtenido) == normalizar_texto(esperado))

    datos[COLUMNA] = [valor(f) for _, f in datos.iterrows()]
    datos[COLUMNA] = datos[COLUMNA].astype(float)
    return datos


@implementa('M3.5')
def exactitud_prioridad(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos = _exactitud(metrica, ctx, 'prioridad', 'prioridad_esperada')
    if datos is None or datos[COLUMNA].notna().sum() == 0:
        return sin_datos(metrica, 'Ninguna tarea de la corrida declara la prioridad esperada.')
    _, filas, contrastes = agregado_por_tarea(metrica, ctx, datos, COLUMNA, contrastes=metrica.con_contrastes)
    aplicables = datos.loc[datos[COLUMNA].notna(), ctx.col_tarea].nunique()
    return ResultadoMetrica(
        metrica.codigo, 'calculada', tuple(filas), tuple(contrastes),
        notas=(
            f'Aplica a {aplicables} tareas: las que declaran esperado.ticket.prioridad. El plan habla de '
            'veinte (diagnostico y compuestas), pero las de diagnostico no declaran prioridad esperada; '
            'ampliarla exige agregarla a las tareas (decision pendiente, RM-17).',
        ),
    )


@implementa('M3.6')
def exactitud_clasificacion(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos = _exactitud(metrica, ctx, 'clasificacion', 'clasificacion_esperada')
    if datos is None or datos[COLUMNA].notna().sum() == 0:
        return sin_datos(metrica, 'Ninguna tarea de la corrida declara la clasificacion esperada.')
    _, filas, contrastes = agregado_por_tarea(metrica, ctx, datos, COLUMNA, contrastes=metrica.con_contrastes)
    observado = valores_por_arquitectura(filas)
    # Matriz de confusion por arquitectura: conteo de (esperada, registrada).
    etiqueta_vacia = metrica.parametro('etiqueta_sin_clasificacion')
    for arquitectura in ctx.registro.arquitecturas:
        de_arq = datos[(datos[ctx.col_arquitectura] == arquitectura) & datos[COLUMNA].notna()]
        conteo: dict[tuple[str, str], int] = {}
        for _, fila in de_arq.iterrows():
            esperada = normalizar_texto(como_objeto(fila[metrica.columna('clasificacion_esperada')]))
            obtenida = como_objeto(fila[metrica.columna('clasificacion')])
            registrada = etiqueta_vacia if obtenida is None else normalizar_texto(obtenida)
            conteo[(esperada, registrada)] = conteo.get((esperada, registrada), 0) + 1
        for (esperada, registrada), n in sorted(conteo.items()):
            filas.append(Fila(arquitectura, 'conteo', float(n), {'esperada': esperada, 'registrada': registrada},
                              n_observaciones=len(de_arq)))
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes), observado_umbral=observado)


# --- M3.2-M3.4: leen los veredictos del juez (decision 52) -------------------------------------


def _con_juez(metrica: Metrica, ctx: Contexto, alias: str) -> tuple[pd.DataFrame | None, str | None]:
    datos = poblacion(metrica, ctx)
    columna = metrica.columna(alias)
    if datos.empty or columna not in datos.columns or datos[columna].isna().all():
        return None, 'La corrida no trae los veredictos del juez (veredictos-juez.jsonl).'
    # Una ejecucion sin veredicto no cuenta como cero: queda fuera.
    return datos[datos[columna].notna()].copy(), None


@implementa('M3.2')
def cobertura_puntos_clave(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos, motivo = _con_juez(metrica, ctx, 'puntos_cubiertos')
    if datos is None:
        return sin_datos(metrica, motivo or '')

    def valor(fila: pd.Series) -> float:
        puntos = como_lista(fila[metrica.columna('puntos_clave')])
        if not puntos:
            return np.nan
        return len(set(como_lista(fila[metrica.columna('puntos_cubiertos')])) & set(puntos)) / len(puntos)

    datos[COLUMNA] = pd.Series([valor(f) for _, f in datos.iterrows()], index=datos.index, dtype=float)
    _, filas, contrastes = agregado_por_tarea(metrica, ctx, datos, COLUMNA, contrastes=metrica.con_contrastes)
    notas: tuple[str, ...] = ()
    columna_respaldo = metrica.columna('puntos_sin_respaldo')
    if columna_respaldo in datos.columns and datos[columna_respaldo].notna().any():
        # Juez v2 (decision 53): la misma cobertura, pero solo sobre los puntos cuya informacion SI le
        # llego al agente. Separa lo que el agente no dijo de lo que el sistema nunca le entrego.
        def con_respaldo(fila: pd.Series) -> float:
            sin = set(como_lista(fila[columna_respaldo]))
            exigibles = [p for p in como_lista(fila[metrica.columna('puntos_clave')]) if p not in sin]
            if not exigibles:
                return np.nan
            return len(set(como_lista(fila[metrica.columna('puntos_cubiertos')])) & set(exigibles)) / len(exigibles)

        datos['_con_respaldo'] = pd.Series([con_respaldo(f) for _, f in datos.iterrows()], index=datos.index,
                                           dtype=float)
        _, filas_resp, pares_resp = agregado_por_tarea(metrica, ctx, datos, '_con_respaldo',
                                                       dimensiones={'puntos': 'con_respaldo'},
                                                       contrastes=metrica.con_contrastes)
        filas += filas_resp
        contrastes += pares_resp
        notas = ('Las filas con puntos=con_respaldo excluyen los puntos cuya informacion no llego al agente '
                 '(buscar_politica devuelve un extracto por politica); las demas miden contra todos los puntos.',)
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes), notas=notas)


@implementa('M3.3')
def violacion_prohibiciones(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos, motivo = _con_juez(metrica, ctx, 'prohibiciones_violadas')
    if datos is None:
        return sin_datos(metrica, motivo or '')
    datos[COLUMNA] = [float(bool(como_lista(f[metrica.columna('prohibiciones_violadas')]))) for _, f in datos.iterrows()]
    _, filas, contrastes = agregado_por_tarea(metrica, ctx, datos, COLUMNA, contrastes=metrica.con_contrastes)
    for arquitectura in ctx.registro.arquitecturas:
        de_arq = datos[datos[ctx.col_arquitectura] == arquitectura]
        filas.append(Fila(arquitectura, 'conteo_ejecuciones', float(de_arq[COLUMNA].sum()), n_observaciones=len(de_arq)))
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), tuple(contrastes),
                            observado_umbral=valores_por_arquitectura(
                                [f for f in filas if f.estadistico.endswith('_entre_tareas')]))


@implementa('M3.4')
def abstencion(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    datos, motivo = _con_juez(metrica, ctx, 'abstencion')
    if datos is None:
        return sin_datos(metrica, motivo or '')
    eje = metrica.parametro('eje_sin_respuesta')
    sin_respuesta = datos[metrica.columna('ejes')].map(lambda v: eje in como_lista(v))
    abstuvo = datos[metrica.columna('abstencion')].map(lambda v: float(como_objeto(v) is True))
    filas: list[Fila] = []
    for tipo, mascara in (('correcta', sin_respuesta), ('indebida', ~sin_respuesta)):
        subconjunto = datos[mascara].copy()
        subconjunto[COLUMNA] = abstuvo[mascara]
        _, filas_tipo, _ = agregado_por_tarea(metrica, ctx, subconjunto, COLUMNA, dimensiones={'abstencion': tipo},
                                              contrastes=False)
        filas += filas_tipo
        for arquitectura in ctx.registro.arquitecturas:
            de_arq = subconjunto[subconjunto[ctx.col_arquitectura] == arquitectura]
            filas.append(Fila(arquitectura, 'conteo', float(de_arq[COLUMNA].sum()), {'abstencion': tipo},
                              n_observaciones=len(de_arq)))
    return ResultadoMetrica(
        metrica.codigo, 'calculada', tuple(filas),
        notas=(f'Tareas sin respuesta posible: las del eje {eje} (cuatro en el conjunto). "correcta" es la '
               'proporcion que se abstiene en ellas (mayor es mejor); "indebida", la que se abstiene en las demas '
               '(menor es mejor). Con cuatro tareas el intervalo es muy ancho.',),
    )
