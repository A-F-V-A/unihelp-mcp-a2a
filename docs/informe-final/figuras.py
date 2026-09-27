"""Figuras del informe final de UniHelp (HU-45: toda figura tiene el codigo que la produce).

Solo LEE valores ya calculados por el cuaderno (RM-02): el `resultados.json` y el
`juez.json` de cada corrida archivada en `experiment/resultados/`, y, para la
efectividad con solo la compuerta automatica, el `resultados.json` de esas mismas
corridas tal como quedo en el commit 3299c79 (el ultimo recalculo antes de
incorporar el juez, decision 52). No promedia modelos ni combina corridas
(decision 49): cada modelo es un panel o una serie aparte.

Uso (desde experiment/, con el entorno uv del proyecto):

    uv run python ../docs/informe-final/figuras.py

Escribe los SVG en docs/informe-final/imagenes/ y los PNG gemelos para el Word.
"""

from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
RESULTADOS = RAIZ / 'experiment' / 'resultados'
SALIDA = Path(__file__).resolve().parent / 'imagenes'
COMMIT_SOLO_COMPUERTA = '3299c79'

# Las cinco campanas completas de la clasificacion A-principal (r3: 40 tareas x 4
# arquitecturas x 3 repeticiones). La etiqueta es solo para el titulo del panel.
CAMPANAS = [
    ('2026-09-25-campana-gpt-5-5-2026-04-23-r3', 'gpt-5.5'),
    ('2026-09-25-campana-gpt-5-4-2026-03-05-r3', 'gpt-5.4'),
    ('2026-09-25-campana-gpt-5-4-mini-2026-03-17-r3', 'gpt-5.4-mini'),
    ('2026-09-25-campana-gpt-4-1-mini-2025-04-14-r3', 'gpt-4.1-mini'),
    ('2026-09-25-campana-unihelp-qwen2-5-7b-instruct-q4_K_M-ctx16k-r3', 'Qwen2.5 7B (local)'),
]
ARQUITECTURAS = ['B0', 'B1', 'B2', 'B3']
# Misma paleta categorica que el cuaderno (analisis.ipynb, celda de figuras).
COLOR = dict(zip(ARQUITECTURAS, ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'], strict=True))
COLOR_COMPONENTE = {
    'modelo': '#2a78d6',
    'herramienta': '#eb6834',
    'transporte': '#1baf7a',
    'orquestacion': '#eda100',
}
CONTRASTES = [('B1', 'B0'), ('B2', 'B1'), ('B3', 'B2')]

plt.rcParams.update({'font.size': 9, 'axes.spines.top': False, 'axes.spines.right': False})


def leer_json(ruta: Path) -> dict:
    return json.loads(ruta.read_text(encoding='utf-8'))


def leer_resultados(carpeta: str) -> dict:
    return leer_json(RESULTADOS / carpeta / 'resultados.json')


def leer_resultados_solo_compuerta(carpeta: str) -> dict:
    ruta = f'{COMMIT_SOLO_COMPUERTA}:experiment/resultados/{carpeta}/resultados.json'
    texto = subprocess.run(
        ['git', 'show', ruta], cwd=RAIZ, capture_output=True, check=True, text=True, encoding='utf-8'
    ).stdout
    return json.loads(texto)


def metrica(resultados: dict, codigo: str) -> dict:
    return next(m for m in resultados['metricas'] if m['codigo'] == codigo)


def fila(resultados: dict, codigo: str, arquitectura: str | None, estadistico: str, **dims) -> dict | None:
    for f in metrica(resultados, codigo).get('filas', []):
        if f.get('arquitectura') != arquitectura and arquitectura is not None:
            continue
        if f['estadistico'] != estadistico:
            continue
        if (f.get('dimensiones') or {}) != dims:
            continue
        return f
    return None


def valor(resultados: dict, codigo: str, arquitectura: str | None, estadistico: str, **dims) -> float:
    f = fila(resultados, codigo, arquitectura, estadistico, **dims)
    if f is None or f.get('valor') is None:
        return math.nan
    return float(f['valor'])


def contraste(resultados: dict, codigo: str, minuendo: str, sustraendo: str, **dims) -> dict | None:
    for c in metrica(resultados, codigo).get('contrastes', []):
        if c['minuendo'] == minuendo and c['sustraendo'] == sustraendo and (c.get('dimensiones') or {}) == dims:
            return c
    return None


def guardar(figura: plt.Figure, nombre: str, lectura: str) -> None:
    figura.text(0.01, 0.005, lectura, fontsize=8, style='italic', ha='left', va='bottom')
    figura.tight_layout(rect=(0, 0.04, 1, 1))
    for extension in ('svg', 'png'):
        figura.savefig(SALIDA / f'{nombre}.{extension}', dpi=150)
    plt.close(figura)
    print(f'escrita {nombre}')


def paneles(titulo: str, n: int = len(CAMPANAS), alto: float = 3.2):
    figura, ejes = plt.subplots(1, n, figsize=(3.1 * n, alto), sharey=False)
    figura.suptitle(titulo, fontsize=11, fontweight='bold')
    return figura, list(ejes)


def figura_tokens(datos: dict[str, dict]) -> None:
    figura, ejes = paneles('Tokens por ejecución (M4.6): mediana entre tareas, por modelo')
    for eje, (carpeta, etiqueta) in zip(ejes, CAMPANAS, strict=True):
        r = datos[carpeta]
        entrada = [valor(r, 'M4.6', a, 'mediana_entre_tareas', tokens='entrada') for a in ARQUITECTURAS]
        salida = [valor(r, 'M4.6', a, 'mediana_entre_tareas', tokens='salida') for a in ARQUITECTURAS]
        x = range(len(ARQUITECTURAS))
        eje.bar(x, entrada, color=[COLOR[a] for a in ARQUITECTURAS], label='entrada')
        eje.bar(x, salida, bottom=entrada, color='#555555', label='salida')
        eje.set_xticks(list(x), ARQUITECTURAS)
        eje.set_title(etiqueta)
        eje.set_ylabel('tokens por ejecución')
    ejes[0].legend(['entrada (color de la arquitectura)', 'salida (gris)'], fontsize=7, loc='upper left')
    guardar(
        figura,
        'fig-tokens',
        'Lectura: B2 y B3 consumen más tokens de entrada que B0 y B1 en los modelos de OpenAI. '
        'Los tokens en caché no los agrega el cuaderno (sin datos como métrica).',
    )


def figura_llamadas(datos: dict[str, dict]) -> None:
    figura, eje = plt.subplots(figsize=(8, 3.6))
    figura.suptitle('Llamadas al modelo por ejecución (M4.4): mediana entre tareas', fontsize=11, fontweight='bold')
    ancho = 0.18
    for i, a in enumerate(ARQUITECTURAS):
        ys = [valor(datos[c], 'M4.4', a, 'mediana_entre_tareas') for c, _ in CAMPANAS]
        eje.bar([j + (i - 1.5) * ancho for j in range(len(CAMPANAS))], ys, ancho, color=COLOR[a], label=a)
    eje.set_xticks(range(len(CAMPANAS)), [e for _, e in CAMPANAS])
    eje.set_ylabel('llamadas al modelo')
    eje.legend(ncol=4, fontsize=8)
    guardar(figura, 'fig-llamadas', 'Lectura: el multiagente (B2, B3) multiplica las llamadas al modelo; MCP (B1) no las cambia.')


def figura_latencia(datos: dict[str, dict]) -> None:
    # Dos filas porque las escalas no se pueden comparar: el modelo tarda segundos y
    # los demas componentes, milisegundos.
    figura, ejes = plt.subplots(2, len(CAMPANAS), figsize=(3.1 * len(CAMPANAS), 6.2))
    figura.suptitle('Latencia: mediana por componente (M4.2) y de extremo a extremo (M4.1)', fontsize=11, fontweight='bold')
    x = list(range(len(ARQUITECTURAS)))
    for columna, (carpeta, etiqueta) in enumerate(CAMPANAS):
        r = datos[carpeta]
        arriba, abajo = ejes[0][columna], ejes[1][columna]
        modelo = [valor(r, 'M4.2', a, 'mediana_entre_tareas', componente='modelo') / 1000 for a in ARQUITECTURAS]
        extremo = [valor(r, 'M4.1', a, 'mediana_entre_tareas') / 1000 for a in ARQUITECTURAS]
        arriba.bar(x, modelo, 0.6, color=COLOR_COMPONENTE['modelo'], label='modelo')
        arriba.scatter(x, extremo, marker='_', s=400, color='black', zorder=3, label='extremo a extremo')
        arriba.set_xticks(x, ARQUITECTURAS)
        arriba.set_title(etiqueta)
        arriba.set_ylabel('segundos')
        ancho = 0.26
        for k, componente in enumerate(['herramienta', 'transporte', 'orquestacion']):
            ys = [valor(r, 'M4.2', a, 'mediana_entre_tareas', componente=componente) for a in ARQUITECTURAS]
            abajo.bar([j + (k - 1) * ancho for j in x], ys, ancho, color=COLOR_COMPONENTE[componente], label=componente)
        abajo.set_xticks(x, ARQUITECTURAS)
        abajo.set_ylabel('milisegundos')
    ejes[0][0].legend(fontsize=7, loc='upper left')
    ejes[1][0].legend(fontsize=7, loc='upper left')
    guardar(
        figura,
        'fig-latencia',
        'Lectura: el modelo explica casi toda la latencia; transporte y orquestación son milisegundos. '
        'Las medianas no son aditivas.',
    )


def figura_costo(datos: dict[str, dict]) -> None:
    figura, (izq, der) = plt.subplots(1, 2, figsize=(11, 3.8))
    figura.suptitle('Costo estimado con la tarifa de lista (M4.7, tarifas.yaml)', fontsize=11, fontweight='bold')
    ancho = 0.18
    modelos = [(c, e) for c, e in CAMPANAS]
    for i, a in enumerate(ARQUITECTURAS):
        por_ejecucion = [valor(datos[c], 'M4.7', a, 'mediana_entre_tareas') for c, _ in modelos]
        por_corrida = [valor(datos[c], 'M4.7', a, 'suma_corrida') for c, _ in modelos]
        xs = [j + (i - 1.5) * ancho for j in range(len(modelos))]
        izq.bar(xs, por_ejecucion, ancho, color=COLOR[a], label=a)
        der.bar(xs, por_corrida, ancho, color=COLOR[a], label=a)
    for eje, unidad in ((izq, 'USD por ejecución (mediana entre tareas)'), (der, 'USD por corrida (suma de 120 ejecuciones)')):
        eje.set_xticks(range(len(modelos)), [e for _, e in modelos], rotation=15)
        eje.set_ylabel(unidad)
    izq.legend(ncol=4, fontsize=8)
    guardar(figura, 'fig-costo', 'Lectura: el costo sigue a los tokens; el modelo local tiene tarifa cero en tarifas.yaml (corre en la máquina).')


def figura_transporte(datos: dict[str, dict]) -> None:
    r = datos[CAMPANAS[0][0]]
    transportes = ['adaptador_local', 'ruta_completa_http', 'mcp_streamable_http', 'a2a_salto']
    nombres = ['en proceso\n(B0)', 'HTTP de la\nruta completa', 'MCP Streamable\nHTTP (B1, B2)', 'salto A2A\n(B3)']
    figura, eje = plt.subplots(figsize=(8, 3.6))
    figura.suptitle('Piso de latencia por transporte (M4.3, microbenchmark sin modelo)', fontsize=11, fontweight='bold')
    p50 = [valor(r, 'M4.3', None, 'p50', transporte=t) for t in transportes]
    p95 = [valor(r, 'M4.3', None, 'p95', transporte=t) for t in transportes]
    x = range(len(transportes))
    eje.bar([j - 0.2 for j in x], p50, 0.4, color='#2a78d6', label='p50')
    eje.bar([j + 0.2 for j in x], p95, 0.4, color='#eb6834', label='p95')
    for j, (a, b) in enumerate(zip(p50, p95, strict=True)):
        eje.text(j - 0.2, a, f'{a:.3g}', ha='center', va='bottom', fontsize=7)
        eje.text(j + 0.2, b, f'{b:.3g}', ha='center', va='bottom', fontsize=7)
    eje.set_xticks(list(x), nombres)
    eje.set_ylabel('milisegundos por llamada')
    eje.legend(fontsize=8)
    guardar(figura, 'fig-transporte', 'Lectura: un salto MCP o A2A cuesta unos 13 a 15 ms; frente a segundos de modelo, es marginal.')


def figura_contrastes(datos: dict[str, dict]) -> None:
    especificacion = [
        ('M4.6', {'tokens': 'total'}, 'Tokens por ejecución (M4.6)', 'diferencia de medianas (tokens)'),
        ('M4.1', {}, 'Latencia de extremo a extremo (M4.1)', 'diferencia de medianas (ms)'),
        ('M1.1', {}, 'Tasa de éxito con juez (M1.1)', 'diferencia de proporciones'),
    ]
    figura, ejes = plt.subplots(1, 3, figsize=(13, 4.2))
    figura.suptitle('Contrastes pareados por tarea con IC 95 % (n = 40 tareas), por modelo', fontsize=11, fontweight='bold')
    marcadores = ['o', 's', 'D', '^', 'v']
    for eje, (codigo, dims, titulo, unidad) in zip(ejes, especificacion, strict=True):
        for k, (carpeta, etiqueta) in enumerate(CAMPANAS):
            for j, (mi, su) in enumerate(CONTRASTES):
                c = contraste(datos[carpeta], codigo, mi, su, **dims)
                if c is None or c.get('diferencia') is None:
                    continue
                y = j + (k - 2) * 0.13
                d, lo, hi = c['diferencia'], c['intervalo']['inferior'], c['intervalo']['superior']
                eje.errorbar(d, y, xerr=[[d - lo], [hi - d]], fmt=marcadores[k], color=f'C{k}', ms=4, capsize=2,
                             label=etiqueta if j == 0 else None)
        eje.axvline(0, color='black', lw=0.8)
        eje.set_yticks(range(len(CONTRASTES)), [f'{a} − {b}' for a, b in CONTRASTES])
        eje.invert_yaxis()
        eje.set_title(titulo)
        eje.set_xlabel(unidad)
    ejes[0].legend(fontsize=7, loc='lower right')
    guardar(
        figura,
        'fig-contrastes',
        'Lectura: B2 − B1 (multiagente) añade tokens y latencia en todos los modelos; B1 − B0 (MCP) y B3 − B2 (A2A) quedan cerca de cero.',
    )


def figura_efectividad(datos: dict[str, dict], solo_compuerta: dict[str, dict]) -> None:
    figura, ejes = paneles('Tasa de éxito (M1.1): solo compuerta frente a compuerta + juez', alto=3.4)
    for eje, (carpeta, etiqueta) in zip(ejes, CAMPANAS, strict=True):
        x = range(len(ARQUITECTURAS))
        compuerta = [valor(solo_compuerta[carpeta], 'M1.1', a, 'media_entre_tareas') for a in ARQUITECTURAS]
        juez = [valor(datos[carpeta], 'M1.1', a, 'media_entre_tareas') for a in ARQUITECTURAS]
        eje.bar([j - 0.2 for j in x], compuerta, 0.4, color='#9bbbe6', label='solo compuerta')
        eje.bar([j + 0.2 for j in x], juez, 0.4, color='#2a78d6', label='compuerta + juez')
        eje.set_ylim(0, 1)
        eje.set_xticks(list(x), ARQUITECTURAS)
        eje.set_title(etiqueta)
        eje.set_ylabel('proporción de tareas')
    ejes[0].legend(fontsize=7, loc='upper left')
    guardar(figura, 'fig-efectividad', 'Lectura: el juez quita éxito en todos los modelos (RM-16); la caída es de nivel, no entre arquitecturas.')


def figura_cobertura(datos: dict[str, dict]) -> None:
    figura, ejes = paneles('Cobertura de puntos clave (M3.2): todos los puntos frente a solo los que tenían respaldo', alto=3.4)
    for eje, (carpeta, etiqueta) in zip(ejes, CAMPANAS, strict=True):
        r = datos[carpeta]
        x = range(len(ARQUITECTURAS))
        todos = [valor(r, 'M3.2', a, 'media_entre_tareas') for a in ARQUITECTURAS]
        respaldo = [valor(r, 'M3.2', a, 'media_entre_tareas', puntos='con_respaldo') for a in ARQUITECTURAS]
        eje.bar([j - 0.2 for j in x], todos, 0.4, color='#f3b48f', label='todos los puntos')
        eje.bar([j + 0.2 for j in x], respaldo, 0.4, color='#eb6834', label='con respaldo')
        eje.set_ylim(0, 1)
        eje.set_xticks(list(x), ARQUITECTURAS)
        eje.set_title(etiqueta)
        eje.set_ylabel('proporción de puntos')
    ejes[0].legend(fontsize=7, loc='lower left')
    guardar(figura, 'fig-cobertura', 'Lectura: parte de lo que el juez marca como faltante nunca llegó al agente (limitación de recuperación, decisión 59).')


def figura_mensajes(datos: dict[str, dict]) -> None:
    figura, eje = plt.subplots(figsize=(8, 3.4))
    figura.suptitle('Mensajes entre agentes por ejecución (M4.5): mediana entre tareas', fontsize=11, fontweight='bold')
    ancho = 0.18
    for i, a in enumerate(ARQUITECTURAS):
        ys = [valor(datos[c], 'M4.5', a, 'mediana_entre_tareas') for c, _ in CAMPANAS]
        eje.bar([j + (i - 1.5) * ancho for j in range(len(CAMPANAS))], ys, ancho, color=COLOR[a], label=a)
    eje.set_xticks(range(len(CAMPANAS)), [e for _, e in CAMPANAS])
    eje.set_ylabel('mensajes')
    eje.legend(ncol=4, fontsize=8)
    guardar(figura, 'fig-mensajes', 'Lectura: solo B2 y B3 intercambian mensajes entre agentes; B0 y B1 tienen un único agente.')


def figura_m6() -> None:
    """M6 (decisiones 58 y 60): las cifras vienen de experiment/m6/resultados-m6.json, que copia las del cuaderno."""
    m6 = leer_json(RAIZ / 'experiment' / 'm6' / 'resultados-m6.json')['implementaciones']
    por_arq = {i['arquitectura']: i for i in m6}
    figura, ejes = plt.subplots(1, 5, figsize=(15, 3.4))
    figura.suptitle('Modularidad al agregar la sexta herramienta (M6), una implementación por arquitectura', fontsize=11, fontweight='bold')
    x = list(range(len(ARQUITECTURAS)))
    for eje, (clave, titulo, unidad) in zip(ejes[:4], [
        ('m6_1_archivos', 'M6.1 archivos modificados', 'archivos (sin pruebas)'),
        ('m6_2_lineas_netas', 'M6.2 líneas netas', 'líneas (sin pruebas)'),
        ('m6_3_servicios_reiniciados', 'M6.3 servicios reiniciados', 'servicios'),
        ('m6_4_minutos', 'M6.4 minutos hasta verde', 'minutos'),
    ], strict=True):
        eje.bar(x, [por_arq[a][clave] for a in ARQUITECTURAS], color=[COLOR[a] for a in ARQUITECTURAS])
        eje.set_xticks(x, ARQUITECTURAS)
        eje.set_title(titulo)
        eje.set_ylabel(unidad)
    eje = ejes[4]
    fases = ['planificacion', 'lectura_contexto', 'implementacion', 'pruebas']
    abajo = [0.0] * len(ARQUITECTURAS)
    for k, fase in enumerate(fases):
        ys = [por_arq[a]['fases_minutos'][fase] for a in ARQUITECTURAS]
        eje.bar(x, ys, bottom=abajo, color=f'C{k}', label=fase.replace('_', ' '))
        abajo = [a + b for a, b in zip(abajo, ys, strict=True)]
    eje.set_xticks(x, ARQUITECTURAS)
    eje.set_title('Proceso de IA por fase')
    eje.set_ylabel('minutos')
    eje.set_ylim(0, max(abajo) * 1.45)
    eje.legend(fontsize=6, loc='upper left', ncol=2)
    guardar(figura, 'fig-m6', 'Lectura: B1 toca menos código y llega antes a verde, pero exige dos reinicios; B2 y B3 cuestan más en archivos y líneas.')


def main() -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    datos = {c: leer_resultados(c) for c, _ in CAMPANAS}
    solo_compuerta = {c: leer_resultados_solo_compuerta(c) for c, _ in CAMPANAS}
    figura_tokens(datos)
    figura_llamadas(datos)
    figura_mensajes(datos)
    figura_latencia(datos)
    figura_costo(datos)
    figura_transporte(datos)
    figura_contrastes(datos)
    figura_efectividad(datos, solo_compuerta)
    figura_cobertura(datos)
    figura_m6()


if __name__ == '__main__':
    main()
