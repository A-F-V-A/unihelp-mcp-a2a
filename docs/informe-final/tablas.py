"""Tablas de cifras del informe final (HU-45: toda cifra tiene el codigo que la extrae).

Solo LEE valores ya calculados por el cuaderno (RM-02) y los transcribe a Markdown:

- `experiment/resultados/<corrida>/resultados.json` de cada campaña archivada;
- el `resultados.json` de esas campañas en el commit 3299c79, el ultimo recalculo
  con solo la compuerta automatica, antes de incorporar el juez (decision 52);
- `resultados.json` de la campaña gpt-5.5 recalculado con el registro 1.3.0 (el que
  trae M6), pasado como argumento;
- `experiment/m6/resultados-m6.json` para el proceso de IA de M6.

No promedia modelos ni combina corridas (decision 49): cada modelo es una fila o
una tabla aparte. Uso, desde experiment/:

    uv run python ../docs/informe-final/tablas.py <resultados.json con registro 1.3.0>

Escribe docs/informe-final/tablas.md.
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
RESULTADOS = RAIZ / 'experiment' / 'resultados'
SALIDA = Path(__file__).resolve().parent / 'tablas.md'
COMMIT_SOLO_COMPUERTA = '3299c79'
ARQ = ['B0', 'B1', 'B2', 'B3']
CONTRASTES = [('B1', 'B0'), ('B2', 'B1'), ('B3', 'B2'), ('B3', 'B1')]

CAMPANAS = [
    ('2026-09-25-campana-gpt-5-5-2026-04-23-r3', 'gpt-5.5'),
    ('2026-09-25-campana-gpt-5-4-2026-03-05-r3', 'gpt-5.4'),
    ('2026-09-25-campana-gpt-5-4-mini-2026-03-17-r3', 'gpt-5.4-mini'),
    ('2026-09-25-campana-gpt-4-1-mini-2025-04-14-r3', 'gpt-4.1-mini'),
    ('2026-09-25-campana-unihelp-qwen2-5-7b-instruct-q4_K_M-ctx16k-r3', 'Qwen2.5 7B (local)'),
    ('2026-09-26-campana-gemini-3-1-flash-lite-r3', 'gemini-3.1-flash-lite (parcial)'),
]


def leer(ruta: Path) -> dict:
    return json.loads(ruta.read_text(encoding='utf-8'))


def leer_git(commit: str, ruta: str) -> dict | None:
    r = subprocess.run(['git', 'show', f'{commit}:{ruta}'], cwd=RAIZ, capture_output=True, text=True, encoding='utf-8')
    return json.loads(r.stdout) if r.returncode == 0 else None


def met(r: dict, codigo: str) -> dict:
    return next(m for m in r['metricas'] if m['codigo'] == codigo)


def val(r: dict | None, clave: str, arq: str | None, est: str, **dims) -> float | None:
    if r is None:
        return None
    for f in met(r, clave).get('filas', []):
        if f.get('arquitectura') == arq and f['estadistico'] == est and (f.get('dimensiones') or {}) == dims:
            return f.get('valor')
    return None


def con(r: dict, codigo: str, mi: str, su: str, **dims) -> dict | None:
    for c in met(r, codigo).get('contrastes', []):
        if c['minuendo'] == mi and c['sustraendo'] == su and (c.get('dimensiones') or {}) == dims:
            return c
    return None


def num(v, dec: int = 0) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return 'sin datos'
    texto = f'{v:,.{dec}f}'.replace(',', ' ').replace('.', ',')
    return texto


def pct(v, dec: int = 1) -> str:
    return 'sin datos' if v is None else num(100 * v, dec) + ' %'


def usd(v) -> str:
    if v is None:
        return 'sin datos'
    return num(v, 4 if abs(v) < 1 else 2)


def fmt_con(c: dict | None, f) -> str:
    if c is None or c.get('diferencia') is None:
        return 'sin datos'
    i = c['intervalo']
    marca = ' *' if i['inferior'] > 0 or i['superior'] < 0 else ''
    return f"{f(c['diferencia'])} [{f(i['inferior'])}; {f(i['superior'])}]{marca}"


def tabla(titulo: str, fuente: str, cabecera: list[str], filas: list[list[str]]) -> str:
    lineas = [f'### {titulo}', '', f'Fuente: {fuente}', '', '| ' + ' | '.join(cabecera) + ' |',
              '| ' + ' | '.join('---' for _ in cabecera) + ' |']
    lineas += ['| ' + ' | '.join(f) + ' |' for f in filas]
    return '\n'.join(lineas) + '\n'


def main() -> None:
    recalculado = leer(Path(sys.argv[1]))
    datos = {c: leer(RESULTADOS / c / 'resultados.json') for c, _ in CAMPANAS}
    compuerta = {c: leer_git(COMMIT_SOLO_COMPUERTA, f'experiment/resultados/{c}/resultados.json') for c, _ in CAMPANAS}
    salida: list[str] = [
        '# Tablas de cifras del informe final',
        '',
        'Generado por `docs/informe-final/tablas.py`; no editar a mano. Cada tabla dice de qué archivo sale.',
        'Los intervalos son bootstrap percentil pareado por tarea al 95 % con n = 40 tareas; un `*` marca',
        'los que excluyen el cero. Las medianas son medianas entre tareas de la mediana de cada tarea.',
        '',
    ]
    fuente_c = '`experiment/resultados/<corrida>/resultados.json`'

    # 1. Corridas
    filas = []
    for c, e in CAMPANAS:
        cor = datos[c]['corrida']
        filas.append([e, f'`{c}`', cor['modelo_id'], str(cor['ejecuciones']['validas']), str(cor['ejecuciones']['intentadas']),
                      f"`{cor['version_codigo']}`", str(cor['semilla'])])
    salida.append(tabla('T1. Campañas que entran al análisis', fuente_c + ', bloque `corrida`',
                        ['Modelo', 'Carpeta', 'Identificador', 'Ejecuciones válidas', 'Intentadas', 'Commit', 'Semilla'], filas))

    # 2. Consumo por modelo y arquitectura
    for c, e in CAMPANAS:
        r = datos[c]
        filas = []
        for a in ARQ:
            filas.append([
                a,
                num(val(r, 'M4.6', a, 'mediana_entre_tareas', tokens='entrada')),
                num(val(r, 'M4.6', a, 'mediana_entre_tareas', tokens='salida')),
                num(val(r, 'M4.6', a, 'mediana_entre_tareas', tokens='total')),
                num(val(r, 'M4.6', a, 'suma_corrida', tokens='total')),
                num(val(r, 'M4.4', a, 'mediana_entre_tareas'), 1),
                num(val(r, 'M4.5', a, 'mediana_entre_tareas'), 1),
                num(val(r, 'M4.1', a, 'mediana_entre_tareas')),
                num(val(r, 'M4.1', a, 'p95_ejecuciones')),
                usd(val(r, 'M4.7', a, 'mediana_entre_tareas')),
                usd(val(r, 'M4.7', a, 'suma_corrida')),
                usd(val(r, 'M4.7', a, 'proyeccion_1000_solicitudes')),
            ])
        salida.append(tabla(f'T2. Consumo · {e}', f'{fuente_c} de `{c}` (M4.1, M4.4, M4.5, M4.6, M4.7)',
                            ['Arq.', 'Tokens entrada (mediana)', 'Tokens salida (mediana)', 'Tokens total (mediana)',
                             'Tokens total (corrida)', 'Llamadas al modelo', 'Mensajes entre agentes', 'Latencia p50 (ms)',
                             'Latencia p95 (ms)', 'USD por ejecución (mediana)', 'USD corrida', 'USD por 1000 solicitudes'], filas))

    # 3. Descomposicion de la latencia
    filas = []
    for c, e in CAMPANAS:
        r = datos[c]
        for a in ARQ:
            filas.append([e, a] + [num(val(r, 'M4.2', a, 'mediana_entre_tareas', componente=k), 1)
                                   for k in ('modelo', 'herramienta', 'transporte', 'orquestacion')]
                         + [pct(val(r, 'M4.2', a, 'mediana_entre_tareas', componente='proporcion_orquestacion'), 2)])
    salida.append(tabla('T3. Descomposición de la latencia (M4.2, medianas en ms)', fuente_c,
                        ['Modelo', 'Arq.', 'Modelo (ms)', 'Herramientas (ms)', 'Transporte (ms)', 'Orquestación (ms)',
                         'Orquestación / total'], filas))

    # 4. Piso de transporte
    r = datos[CAMPANAS[0][0]]
    filas = []
    for t in ('adaptador_local', 'mcp_streamable_http', 'a2a_salto', 'ruta_completa_http'):
        filas.append([f'`{t}`'] + [num(val(r, 'M4.3', None, e, transporte=t), 3) for e in ('p50', 'p95', 'p99', 'desviacion_estandar')])
    salida.append(tabla('T4. Piso de latencia por transporte (M4.3, ms por llamada)',
                        '`experiment/bench-transport.json` calculado por el cuaderno (igual en todas las corridas)',
                        ['Transporte', 'p50', 'p95', 'p99', 'Desviación estándar'], filas))

    # 5. Contrastes de consumo
    for codigo, dims, nombre, f in (
        ('M4.6', {'tokens': 'total'}, 'Tokens totales por ejecución', lambda v: num(v)),
        ('M4.1', {}, 'Latencia de extremo a extremo (ms)', lambda v: num(v)),
        ('M4.7', {}, 'Costo por ejecución (USD)', usd),
        ('M4.5', {}, 'Mensajes entre agentes', lambda v: num(v, 1)),
    ):
        filas = []
        for c, e in CAMPANAS:
            filas.append([e] + [fmt_con(con(datos[c], codigo, mi, su, **dims), f) for mi, su in CONTRASTES])
        salida.append(tabla(f'T5. Contrastes pareados · {nombre} ({codigo})', fuente_c + ', campo `contrastes`',
                            ['Modelo'] + [f'{mi} − {su}' for mi, su in CONTRASTES], filas))

    # 6. Efectividad: solo compuerta y con juez
    filas = []
    for c, e in CAMPANAS:
        filas.append([e] + [f"{pct(val(compuerta[c], 'M1.1', a, 'media_entre_tareas'))} / {pct(val(datos[c], 'M1.1', a, 'media_entre_tareas'))}" for a in ARQ])
    salida.append(tabla('T6. Tasa de éxito M1.1: solo compuerta / compuerta + juez',
                        f'solo compuerta: `resultados.json` en el commit {COMMIT_SOLO_COMPUERTA}; con juez: {fuente_c}',
                        ['Modelo'] + ARQ, filas))
    for nombre, fuente, fuentes in (('solo compuerta', f'commit {COMMIT_SOLO_COMPUERTA}', compuerta), ('compuerta + juez', 'actual', datos)):
        filas = []
        for c, e in CAMPANAS:
            filas.append([e] + [fmt_con(con(fuentes[c], 'M1.1', mi, su), lambda v: pct(v)) if fuentes[c] else 'sin datos' for mi, su in CONTRASTES])
        salida.append(tabla(f'T7. Contrastes de la tasa de éxito ({nombre})', f'`resultados.json` {fuente}, M1.1',
                            ['Modelo'] + [f'{mi} − {su}' for mi, su in CONTRASTES], filas))

    # 8. Conducta: M2
    filas = []
    for c, e in CAMPANAS:
        r = datos[c]
        for a in ARQ:
            filas.append([e, a, pct(val(r, 'M2.1', a, 'media_entre_tareas')),
                          num(val(r, 'M2.2', a, 'conteo_ejecuciones')),
                          pct(val(r, 'M2.3', a, 'media_entre_tareas')),
                          pct(val(r, 'M2.4', a, 'media_entre_tareas')),
                          num(val(r, 'M2.5', a, 'media_ejecuciones'), 2),
                          pct(val(r, 'M2.6', a, 'proporcion_llamadas', codigo='todos'), 2)])
    salida.append(tabla('T8. Uso de herramientas (M2)', fuente_c,
                        ['Modelo', 'Arq.', 'M2.1 obligatorias cubiertas', 'M2.2 ejecuciones con herramienta prohibida',
                         'M2.3 argumentos válidos', 'M2.4 orden parcial', 'M2.5 llamadas superfluas (media)',
                         'M2.6 error de herramienta'], filas))

    # 9. Calidad segun compuerta y juez: M3
    filas = []
    for c, e in CAMPANAS:
        r = datos[c]
        for a in ARQ:
            filas.append([e, a, pct(val(r, 'M3.1', a, 'media_entre_tareas')),
                          pct(val(r, 'M3.2', a, 'media_entre_tareas')),
                          pct(val(r, 'M3.2', a, 'media_entre_tareas', puntos='con_respaldo')),
                          num(val(r, 'M3.3', a, 'conteo_ejecuciones')),
                          pct(val(r, 'M3.4', a, 'media_entre_tareas', abstencion='correcta')),
                          pct(val(r, 'M3.5', a, 'media_entre_tareas'))])
    salida.append(tabla('T9. Fidelidad y calidad de la respuesta (M3)', fuente_c + '; M3.2 y M3.3 vienen del juez',
                        ['Modelo', 'Arq.', 'M3.1 fidelidad de citación', 'M3.2 cobertura (todos)', 'M3.2 cobertura (con respaldo)',
                         'M3.3 ejecuciones con prohibición violada', 'M3.4 abstención correcta', 'M3.5 prioridad exacta'], filas))

    # 10. Seguridad: M5
    filas = []
    for c, e in CAMPANAS:
        r = datos[c]
        for a in ARQ:
            filas.append([e, a, num(val(r, 'M5.1', a, 'conteo')), pct(val(r, 'M5.2', a, 'proporcion')),
                          pct(val(r, 'M5.3', a, 'media_entre_tareas')), pct(val(r, 'M5.4', a, 'media_entre_tareas')),
                          pct(val(r, 'M5.5', a, 'minimo_entre_vectores')), pct(val(r, 'M5.6', a, 'proporcion')),
                          num(val(r, 'M5.7', a, 'conteo'))])
    salida.append(tabla('T10. Control de escritura y seguridad (M5)', fuente_c,
                        ['Modelo', 'Arq.', 'M5.1 escrituras no autorizadas', 'M5.2 rechazo mecánico',
                         'M5.3 solicitud de confirmación', 'M5.4 falso bloqueo', 'M5.5 resistencia (vector más débil)',
                         'M5.6 alcance respetado', 'M5.7 exposición de terceros'], filas))

    # 11. Fiabilidad y juez-humano
    filas = []
    for c, e in CAMPANAS:
        r = datos[c]
        filas.append([e, pct(val(r, 'M7.1', None, 'proporcion')), pct(val(r, 'M7.2', None, 'proporcion')),
                      pct(val(r, 'M7.3', None, 'proporcion')), num(val(r, 'M7.4', None, 'kappa_cohen'), 2),
                      pct(val(r, 'M7.5', None, 'proporcion')), met(r, 'M7.6')['estado'], met(r, 'M7.7')['estado']])
    salida.append(tabla('T11. Fiabilidad del experimento (M7)', fuente_c,
                        ['Modelo', 'M7.1 trazas completas', 'M7.2 estado inicial íntegro', 'M7.3 reejecución por infraestructura',
                         'M7.4 kappa entre revisores', 'M7.5 acuerdo juez-humano', 'M7.6', 'M7.7'], filas))

    # 12. Estado de las 43 metricas
    filas = []
    for m in recalculado['metricas']:
        umbral = m.get('umbral') or {}
        alc = umbral.get('alcanza')
        filas.append([m['codigo'], m['nombre'], m['rol'], ', '.join(m.get('hipotesis') or []), m['tipo_valor_esperado'],
                      m['estado'], '—' if not umbral else ('sí' if alc else 'no' if alc is False else 'no evaluable')])
    salida.append(tabla('T12. Las 43 métricas y su estado en la campaña gpt-5.5 (registro 1.3.0)',
                        '`resultados.json` recalculado con el registro 1.3.0 sobre `2026-09-25-campana-gpt-5-5-2026-04-23-r3`',
                        ['Código', 'Nombre', 'Rol', 'Hipótesis', 'Tipo', 'Estado', 'Alcanza el umbral'], filas))

    # 13. M6
    m6 = leer(RAIZ / 'experiment' / 'm6' / 'resultados-m6.json')
    filas = []
    for a in ARQ:
        filas.append([a, num(val(recalculado, 'M6.1', a, 'archivos')), num(val(recalculado, 'M6.1', a, 'archivos_con_pruebas')),
                      num(val(recalculado, 'M6.2', a, 'lineas_netas')), num(val(recalculado, 'M6.2', a, 'lineas_prueba_netas')),
                      num(val(recalculado, 'M6.3', a, 'servicios')), num(val(recalculado, 'M6.4', a, 'minutos'), 1),
                      num(val(recalculado, 'M6.5', a, 'regresion_ok'))])
    salida.append(tabla('T13. Modularidad al agregar la sexta herramienta (M6)', '`resultados.json` recalculado (registro 1.3.0), familia M6',
                        ['Arq.', 'M6.1 archivos', 'Archivos con pruebas', 'M6.2 líneas netas', 'Líneas de prueba',
                         'M6.3 servicios reiniciados', 'M6.4 minutos hasta verde', 'M6.5 regresión'], filas))
    filas = []
    for i in m6['implementaciones']:
        fm = i['fases_minutos']
        filas.append([i['arquitectura'], str(i['orden'])] + [num(fm[k], 1) for k in ('planificacion', 'lectura_contexto', 'implementacion', 'pruebas')]
                     + [num(i['tokens_subagente']), str(i['llamadas_herramientas']), str(i['iteraciones_de_prueba']),
                        str(i['archivos_leidos']), num(i['lineas_leidas']), ', '.join(i['m6_3_servicios'])])
    salida.append(tabla('T14. Proceso de IA de M6', '`experiment/m6/resultados-m6.json`',
                        ['Arq.', 'Orden', 'Planificación (min)', 'Lectura (min)', 'Implementación (min)', 'Pruebas (min)',
                         'Tokens del subagente', 'Llamadas a herramientas', 'Iteraciones de prueba', 'Archivos leídos',
                         'Líneas leídas', 'Servicios reiniciados'], filas))

    SALIDA.write_text('\n'.join(salida), encoding='utf-8')
    print(f'escrito {SALIDA}')


if __name__ == '__main__':
    main()
