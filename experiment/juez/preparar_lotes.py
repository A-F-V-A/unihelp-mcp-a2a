"""Arma los lotes CIEGOS que califica el juez (docs/04, compuerta 2; decision 52).

    cd experiment && uv run python juez/preparar_lotes.py

Lee cada corrida archivada con trazas en `resultados/` y escribe:

- `juez/lotes/lote-NNN.jsonl`: una ejecucion por linea, SIN arquitectura, modelo,
  corrida ni run_id: solo el identificador ciego, la tarea, el dialogo, la
  respuesta final, la rubrica y lo que devolvieron las cinco herramientas.
- `juez/clave-ciega.json`: identificador ciego -> (carpeta, run_id). El juez no la abre.

Cada corrida ocupa lotes contiguos (ninguno mezcla dos corridas) y dentro de
ella el orden se baraja con semilla, asi que las cuatro arquitecturas quedan
entremezcladas. Las corridas van en orden de prioridad (`PRIORIDAD`): un juicio
interrumpido deja corridas ENTERAS juzgadas, que es lo unico que `incorporar.py`
acepta, porque un juez aplicado a media corrida sesgaria M1. Lotes y clave se
regeneran identicos con la misma semilla: no se versionan.
"""

from __future__ import annotations

import json
import random
import re
import shutil
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent
EXPERIMENTO = RAIZ.parent
TAREAS = EXPERIMENTO.parent / 'docs' / 'tasks'
SEMILLA = 20260927
TAMANO_LOTE = 20
MAX_CARACTERES_RESULTADO = 6000
# Solo las cinco herramientas: sus resultados tienen la misma forma en las cuatro
# arquitecturas. Las delegaciones entre agentes delatarian B2/B3.
# Primero las matrices completas con mas peso en el estudio; al final lo historico.
PRIORIDAD = [
    '2026-09-25-campana-gpt-5-5-2026-04-23-r3',
    '2026-09-25-campana-gpt-5-4-2026-03-05-r3',
    '2026-09-25-campana-gpt-5-4-mini-2026-03-17-r3',
    '2026-09-25-campana-gpt-4-1-mini-2025-04-14-r3',
    '2026-09-25-campana-unihelp-qwen2-5-7b-instruct-q4_K_M-ctx16k-r3',
    '2026-09-26-campana-gemini-3-1-flash-lite-r3',
    '2026-09-25-cuatro-arquitecturas-r1',
]
CAMPOS_IDENTIFICADORES = {'traceId', 'trace_id', 'conversacionId', 'conversacion_id', 'actor', 'agente',
                          'transporte', 'run_id', 'sesion'}
PATRON_TRAZA = re.compile(r'run-[0-9TZ]+-T-[A-Z]{3}-\d{3}-B\d-r\d+|\b(?:b[0-3]-(?:agent|orquestador|conocimiento|diagnostico))\b')
HERRAMIENTAS = {'buscar_politica', 'consultar_estado_servicio', 'proponer_ticket', 'confirmar_propuesta',
                'crear_ticket_simulado'}


def rubrica(tarea: str) -> dict:
    esperado = yaml.safe_load((TAREAS / f'{tarea}.yaml').read_text(encoding='utf-8'))['esperado']
    return {
        'puntos_clave': [f'{i}. {p}' for i, p in enumerate(esperado.get('puntos_clave_respuesta') or [], 1)],
        'prohibiciones': [f'{i}. {p}' for i, p in enumerate(esperado.get('prohibiciones_respuesta') or [], 1)],
    }


def cegar(valor):
    """Quita de un resultado todo lo que identifica la ejecucion (y con ella la arquitectura).

    Los tickets guardan el `traceId` (`run-...-T-COM-004-B2-r2`) y el actor; nada de eso
    hace falta para juzgar la respuesta.
    """
    if isinstance(valor, dict):
        return {k: cegar(v) for k, v in valor.items() if k not in CAMPOS_IDENTIFICADORES}
    if isinstance(valor, list):
        return [cegar(v) for v in valor]
    if isinstance(valor, str):
        return PATRON_TRAZA.sub('[oculto]', valor)
    return valor


def recortar(valor) -> object:
    valor = cegar(valor)
    texto = json.dumps(valor, ensure_ascii=False)
    if len(texto) <= MAX_CARACTERES_RESULTADO:
        return valor
    return texto[:MAX_CARACTERES_RESULTADO] + ' …[recortado]'


def item(traza: dict, identificador: str, rubricas: dict) -> dict:
    tarea = traza['task_id']
    if tarea not in rubricas:
        rubricas[tarea] = rubrica(tarea)
    return {
        'id': identificador,
        'tarea': tarea,
        'dialogo': [{'rol': t['rol'], 'texto': t['texto']} for t in traza.get('conversation') or []],
        'respuesta_final': traza['outcome'].get('final_answer'),
        **rubricas[tarea],
        'informacion_recuperada': [
            {'herramienta': c['nombre'], 'resultado': recortar(c.get('resultado'))}
            for c in traza.get('tool_calls') or []
            if c.get('nombre') in HERRAMIENTAS and c.get('resultado') is not None
        ],
    }


def main() -> None:
    carpetas = [p for p in (EXPERIMENTO / 'resultados').iterdir() if (p / 'trazas.jsonl').exists()]
    carpetas.sort(key=lambda p: (PRIORIDAD.index(p.name) if p.name in PRIORIDAD else len(PRIORIDAD), p.name))
    azar = random.Random(SEMILLA)

    lotes = RAIZ / 'lotes'
    if lotes.exists():
        shutil.rmtree(lotes)
    lotes.mkdir()
    (RAIZ / 'veredictos').mkdir(exist_ok=True)
    rubricas: dict = {}
    clave: dict = {}
    numero, posicion = 0, 0
    for carpeta in carpetas:
        trazas = [json.loads(l) for l in (carpeta / 'trazas.jsonl').open(encoding='utf-8') if l.strip()]
        azar.shuffle(trazas)
        primero = numero + 1
        for inicio in range(0, len(trazas), TAMANO_LOTE):
            numero += 1
            with (lotes / f'lote-{numero:03d}.jsonl').open('w', encoding='utf-8', newline='\n') as archivo:
                for traza in trazas[inicio:inicio + TAMANO_LOTE]:
                    posicion += 1
                    identificador = f'J-{posicion:05d}'
                    clave[identificador] = {'carpeta': carpeta.name, 'run_id': traza['run_id'], 'lote': numero}
                    archivo.write(json.dumps(item(traza, identificador, rubricas), ensure_ascii=False) + '\n')
        print(f'lotes {primero:3d}-{numero:3d}: {len(trazas):4d} ejecuciones de {carpeta.name}')
    (RAIZ / 'clave-ciega.json').write_text(json.dumps(clave, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{posicion} ejecuciones en {numero} lotes.')


if __name__ == '__main__':
    main()
