"""Familia M6: modularidad al agregar la sexta herramienta (decisiones 58 y 60).

Una sola implementacion por arquitectura: cada metrica da un valor por arquitectura,
sin intervalo ni contrastes (n = 1). Los insumos son de alcance experimento
(experiment/m6/), comunes a todas las corridas.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from typing import Any

from ..registro import Metrica
from .comun import Contexto, Fila, ResultadoMetrica, implementa, sin_datos

NS_POR_MINUTO = 60 * 10**9
ALIAS_IMPLEMENTACIONES = 'implementaciones'
ALIAS_ARQUITECTURA = 'arquitectura'


def _implementaciones(
    metrica: Metrica, ctx: Contexto, insumo: str
) -> Iterator[tuple[str, Mapping[str, Any]]] | None:
    datos = ctx.insumos.get(insumo)
    if datos is None:
        return None
    clave = metrica.subcampo(ALIAS_ARQUITECTURA)
    lista = datos[metrica.campo(ALIAS_IMPLEMENTACIONES)]
    return ((impl[clave], impl) for impl in sorted(lista, key=lambda i: i[clave]))


def _archivos_contados(metrica: Metrica, impl: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    excluidas = set(metrica.parametro('clases_excluidas'))
    clase = metrica.subcampo('clase')
    return [a for a in impl[metrica.subcampo('archivos')] if a[clase] not in excluidas]


@implementa('M6.1')
def archivos_modificados(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    implementaciones = _implementaciones(metrica, ctx, 'repositorio')
    if implementaciones is None:
        return sin_datos(metrica, 'No hay m6/repositorio.json: el experimento M6 no se ha corrido.')
    clase = metrica.subcampo('clase')
    filas: list[Fila] = []
    for arquitectura, impl in implementaciones:
        filas.append(Fila(arquitectura, 'archivos', float(len(_archivos_contados(metrica, impl))), n_observaciones=1))
        todos = impl[metrica.subcampo('archivos')]
        filas.append(Fila(arquitectura, 'archivos_con_pruebas', float(len(todos)), n_observaciones=1))
        for nombre in sorted({a[clase] for a in todos}):
            conteo = sum(1 for a in todos if a[clase] == nombre)
            filas.append(Fila(arquitectura, 'archivos', float(conteo), {'clase': nombre}, n_observaciones=1))
    return ResultadoMetrica(
        metrica.codigo,
        'calculada',
        tuple(filas),
        notas=('Una implementacion por arquitectura: sin intervalo ni contrastes.',),
    )


@implementa('M6.2')
def lineas_netas(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    implementaciones = _implementaciones(metrica, ctx, 'repositorio')
    if implementaciones is None:
        return sin_datos(metrica, 'No hay m6/repositorio.json: el experimento M6 no se ha corrido.')
    anadidas, eliminadas = metrica.subcampo('anadidas'), metrica.subcampo('eliminadas')
    clase, prueba = metrica.subcampo('clase'), metrica.parametro('clase_prueba')
    filas: list[Fila] = []
    for arquitectura, impl in implementaciones:
        contados = _archivos_contados(metrica, impl)
        mas = sum(a[anadidas] for a in contados)
        menos = sum(a[eliminadas] for a in contados)
        pruebas = [a for a in impl[metrica.subcampo('archivos')] if a[clase] == prueba]
        filas += [
            Fila(arquitectura, 'lineas_netas', float(mas - menos), n_observaciones=1),
            Fila(arquitectura, 'anadidas', float(mas), n_observaciones=1),
            Fila(arquitectura, 'eliminadas', float(menos), n_observaciones=1),
            Fila(
                arquitectura,
                'lineas_prueba_netas',
                float(sum(a[anadidas] - a[eliminadas] for a in pruebas)),
                n_observaciones=1,
            ),
        ]
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas))


@implementa('M6.3')
def servicios_reiniciados(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    implementaciones = _implementaciones(metrica, ctx, 'verificacion_manual')
    if implementaciones is None:
        return sin_datos(metrica, 'No hay m6/verificacion-manual.json: el experimento M6 no se ha corrido.')
    campo = metrica.subcampo('servicios_reiniciados')
    filas: list[Fila] = []
    notas: list[str] = []
    for arquitectura, impl in implementaciones:
        servicios = impl[campo]
        if servicios is None:
            notas.append(f'{arquitectura}: la verificacion practica no se hizo.')
            filas.append(Fila(arquitectura, 'servicios', None))
            continue
        filas.append(Fila(arquitectura, 'servicios', float(len(servicios)), n_observaciones=1))
        notas.append(f'{arquitectura}: {", ".join(servicios) or "ninguno"}.')
    observado = {f.arquitectura: f.valor for f in filas}
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), observado_umbral=observado, notas=tuple(notas))


def _minutos(marcas: list[Mapping[str, Any]], metrica: Metrica, fase_a: str, evento_a: str, fase_b: str, evento_b: str) -> float | None:
    fase, evento, reloj = metrica.subcampo('fase'), metrica.subcampo('evento'), metrica.subcampo('monotono')

    def buscar(nombre: str, tipo: str) -> list[int]:
        return [m[reloj] for m in marcas if m[fase] == nombre and m[evento] == tipo]

    # La primera marca de inicio y la ultima de fin: un reinicio de fase no acorta la medida.
    inicios, fines = buscar(fase_a, evento_a), buscar(fase_b, evento_b)
    if not inicios or not fines:
        return None
    return (max(fines) - min(inicios)) / NS_POR_MINUTO


@implementa('M6.4')
def minutos_hasta_verde(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    implementaciones = _implementaciones(metrica, ctx, 'verificacion_manual')
    if implementaciones is None:
        return sin_datos(metrica, 'No hay m6/verificacion-manual.json: el experimento M6 no se ha corrido.')
    inicio, fin = metrica.parametro('evento_inicio'), metrica.parametro('evento_fin')
    filas: list[Fila] = []
    notas: list[str] = []
    for arquitectura, impl in implementaciones:
        marcas = impl[metrica.subcampo('marcas')]
        total = _minutos(marcas, metrica, metrica.parametro('fase_inicio'), inicio, metrica.parametro('fase_fin'), fin)
        if total is None:
            notas.append(f'{arquitectura}: faltan las marcas de inicio o de fin.')
        filas.append(Fila(arquitectura, 'minutos', total, n_observaciones=1 if total is not None else None))
        for fase in metrica.parametro('fases_desglose'):
            valor = _minutos(marcas, metrica, fase, inicio, fase, fin)
            filas.append(Fila(arquitectura, 'minutos', valor, {'fase': fase}, n_observaciones=1 if valor is not None else None))
    notas.append('Reloj monotono de la maquina (RM-06); una sola observacion por arquitectura.')
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), notas=tuple(notas))


@implementa('M6.5')
def regresion_sin_tocar_pruebas(metrica: Metrica, ctx: Contexto) -> ResultadoMetrica:
    implementaciones = _implementaciones(metrica, ctx, 'integracion_continua')
    if implementaciones is None:
        return sin_datos(metrica, 'No hay m6/integracion-continua.json: el experimento M6 no se ha corrido.')
    verde, editadas = metrica.subcampo('suite_verde'), metrica.subcampo('pruebas_editadas')
    filas: list[Fila] = []
    notas: list[str] = []
    for arquitectura, impl in implementaciones:
        valor = 1.0 if impl[verde] and not impl[editadas] else 0.0
        filas.append(Fila(arquitectura, 'regresion_ok', valor, n_observaciones=1))
        if valor == 0.0:
            notas.append(f'{arquitectura}: M6.5 = 0 invalida M6.1 a M6.4 de esta arquitectura.')
    observado = {f.arquitectura: f.valor for f in filas}
    return ResultadoMetrica(metrica.codigo, 'calculada', tuple(filas), observado_umbral=observado, notas=tuple(notas))
