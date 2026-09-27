"""Arma m6/resultados-m6.json: M6.1-M6.5 tal como las calculo el cuaderno, mas el proceso de IA.

    cd experiment && uv run python m6/consolidar.py salidas/<carpeta>/resultados.json

Las cifras de M6.1-M6.5 se COPIAN del resultados.json del cuaderno (RM-02); aqui solo
se agregan datos descriptivos del proceso que no son metricas del registro: tokens y
llamadas a herramientas de cada subagente (uso-agentes.jsonl), iteraciones de prueba
que reporto y tamano de lo que dijo leer (archivos-leidos.json, medido sobre m6-base).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ_REPO = AQUI.parents[1]
ORDEN = ['B0', 'B3', 'B2', 'B1']  # sorteado con semilla 20261016 (bitacora)


def filas(resultados: dict, codigo: str) -> list[dict]:
    return next(m for m in resultados['metricas'] if m['codigo'] == codigo)['filas']


def valor(resultados: dict, codigo: str, arq: str, estadistico: str, **dims: str):
    for f in filas(resultados, codigo):
        if f['arquitectura'] == arq and f['estadistico'] == estadistico and (f.get('dimensiones') or {}) == dims:
            return f['valor']
    return None


def tamano_leido(rutas: list) -> dict:
    """Lineas y bytes de cada archivo tal como estaba en m6-base (git show)."""
    archivos = lineas = octetos = 0
    parciales = 0
    for entrada in rutas:
        ruta = entrada if isinstance(entrada, str) else entrada['ruta']
        parciales += 0 if isinstance(entrada, str) else int(entrada.get('parcial', False))
        try:
            datos = subprocess.run(
                ['git', 'show', f'm6-base:{ruta}'], cwd=RAIZ_REPO, check=True, capture_output=True
            ).stdout
        except subprocess.CalledProcessError:
            continue
        archivos += 1
        lineas += datos.count(b'\n')
        octetos += len(datos)
    return {'archivos_leidos': archivos, 'archivos_leidos_parciales': parciales, 'lineas_leidas': lineas, 'bytes_leidos': octetos}


def main() -> int:
    resultados = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    uso = {
        d['arquitectura']: d
        for d in (json.loads(l) for l in (AQUI / 'uso-agentes.jsonl').read_text(encoding='utf-8').splitlines() if l.strip())
    }
    leidos = json.loads((AQUI / 'archivos-leidos.json').read_text(encoding='utf-8'))
    servicios = json.loads((AQUI / 'servicios-reiniciados.json').read_text(encoding='utf-8'))
    salida = []
    for arq in ['B0', 'B1', 'B2', 'B3']:
        salida.append({
            'arquitectura': arq,
            'orden': ORDEN.index(arq) + 1,
            'modelo': uso[arq]['modelo'],
            'ventana_contexto_tokens': 1_000_000,
            'esfuerzo': 'por defecto de Claude Code (medio)',
            'commit': uso[arq]['commit'][:7],
            'verde': uso[arq]['verde_reportado'],
            'm6_1_archivos': valor(resultados, 'M6.1', arq, 'archivos'),
            'm6_1_archivos_con_pruebas': valor(resultados, 'M6.1', arq, 'archivos_con_pruebas'),
            'm6_2_lineas_netas': valor(resultados, 'M6.2', arq, 'lineas_netas'),
            'm6_2_anadidas': valor(resultados, 'M6.2', arq, 'anadidas'),
            'm6_2_eliminadas': valor(resultados, 'M6.2', arq, 'eliminadas'),
            'lineas_prueba_nuevas': valor(resultados, 'M6.2', arq, 'lineas_prueba_netas'),
            'm6_3_servicios_reiniciados': valor(resultados, 'M6.3', arq, 'servicios'),
            'm6_3_servicios': servicios[arq]['servicios'],
            'm6_3_solo_mcp_server_basto': servicios[arq]['solo_mcp_server_basto'],
            'm6_4_minutos': valor(resultados, 'M6.4', arq, 'minutos'),
            'fases_minutos': {
                fase: valor(resultados, 'M6.4', arq, 'minutos', fase=fase)
                for fase in ('planificacion', 'lectura_contexto', 'implementacion', 'pruebas')
            },
            'iteraciones_de_prueba': uso[arq]['iteraciones_reportadas'],
            **tamano_leido(leidos[arq]),
            'tokens_subagente': uso[arq]['tokens_subagente'],
            'llamadas_herramientas': uso[arq]['llamadas_herramientas'],
            'duracion_subagente_min': round(uso[arq]['duracion_ms'] / 60000, 2),
            'm6_5_regresion_ok': valor(resultados, 'M6.5', arq, 'regresion_ok'),
            'evidencias': [
                f'evidencias/verify-{arq.lower()}.resumen.txt',
                servicios[arq]['evidencia'],
                *(['evidencias/m63-b1-diagnostico/resumen.json',
                   'evidencias/m63-b1-diagnostico-sin-conversacion-previa/resumen.json'] if arq == 'B1' else []),
            ],
        })
    documento = {
        'fuente_metricas': sys.argv[1],
        'version_registro': resultados['corrida'].get('version_registro'),
        'base': 'm6-base (1afafb7)',
        'orden_sorteado': ORDEN,
        'semilla_orden': 20261016,
        'implementaciones': salida,
    }
    (AQUI / 'resultados-m6.json').write_text(json.dumps(documento, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for s in salida:
        print({k: s[k] for k in ('arquitectura', 'm6_1_archivos', 'm6_2_lineas_netas', 'm6_3_servicios_reiniciados', 'm6_4_minutos', 'm6_5_regresion_ok', 'archivos_leidos', 'lineas_leidas', 'bytes_leidos')})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
