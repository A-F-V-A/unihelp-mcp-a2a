"""Funciones de calculo por familia. Importarlas registra sus metricas.

`calcular` exige que el conjunto de funciones y el de metricas `implementada` del
registro sean identicos: una metrica sin funcion, o una funcion sin ficha, detiene
el analisis (HU-MET-02).
"""

from __future__ import annotations

from ..registro import ErrorRegistro
from . import m1_efectividad, m4_eficiencia, m7_fiabilidad  # noqa: F401  (registran sus metricas)
from .comun import Contexto, ResultadoMetrica, implementaciones

__all__ = ['Contexto', 'ResultadoMetrica', 'calcular', 'diferencias_con_registro', 'implementaciones']


def diferencias_con_registro(ctx_registro) -> tuple[list[str], list[str]]:
    """(implementadas en el registro sin funcion, funciones sin metrica implementada)."""
    funciones = set(implementaciones())
    declaradas = {m.codigo for m in ctx_registro.implementadas()}
    existentes = {m.codigo for m in ctx_registro.metricas}
    sin_funcion = sorted(declaradas - funciones)
    sin_ficha = sorted(funciones - declaradas)
    # Una funcion para una metrica que el registro marca como pendiente tambien es incoherente.
    sin_ficha += sorted(c for c in funciones & existentes if c not in declaradas and c not in sin_ficha)
    return sin_funcion, sorted(set(sin_ficha))


def calcular(ctx: Contexto) -> dict[str, ResultadoMetrica]:
    """Calcula todas las metricas implementadas, en el orden del registro."""
    sin_funcion, sin_ficha = diferencias_con_registro(ctx.registro)
    if sin_funcion or sin_ficha:
        raise ErrorRegistro(
            f'Registro y codigo no coinciden. Sin funcion: {sin_funcion}. '
            f'Sin metrica implementada en el registro: {sin_ficha}'
        )
    funciones = implementaciones()
    return {m.codigo: funciones[m.codigo](m, ctx) for m in ctx.registro.implementadas()}
