"""Diagnostico secundario de M6.3 en B1: ¿reconecta B1 si su sesion MCP muere?

    cd experiment && uv run python m6/diagnostico_b1_sesion.py

No cambia M6.3 (lo decide verificar_m63.py). Explica su resultado: con B1 de la base
arriba y una conversacion previa (asi B1 ya guardo su lista de cinco herramientas,
como un sistema en uso), reinicia SOLO mcp-server con la rama y abre tres
conversaciones nuevas:

1. la pregunta del caso 9 (B1 aun tiene en memoria la lista de cinco herramientas);
2. una pregunta que exige una herramienta que ya existia, para forzar un `tools/call`
   sobre la sesion que el reinicio dejo muerta;
3. otra vez la pregunta del caso 9.

Si en la 3 el agente usa la herramienta, B1 la descubre sin reiniciarse despues de
que su cliente detecta la sesion rota. Evidencia en evidencias/m63-b1-diagnostico/.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import verificar_m63 as v  # noqa: E402

# Con --sin-conversacion-previa, B1 pide tools/list por primera vez despues del reinicio.
SIN_CONVERSACION_PREVIA = '--sin-conversacion-previa' in sys.argv
PREGUNTA_EXISTENTE = '¿Cuál es el estado actual del servicio de correo institucional?'


def main() -> int:
    banco = v.Banco('B1')
    sufijo = '-sin-conversacion-previa' if SIN_CONVERSACION_PREVIA else ''
    banco.evidencias = v.AQUI / 'evidencias' / f'm63-b1-diagnostico{sufijo}'
    banco.logs = banco.evidencias / 'logs'
    banco.logs.mkdir(parents=True, exist_ok=True)
    pasos = []
    try:
        for app in v.SERVICIOS['B1']:
            banco.arrancar(app, 'base')
        if not SIN_CONVERSACION_PREVIA:
            pasos.append(banco.conversar('0-caso9-en-la-base'))
        banco.reiniciar('mcp-server', 'rama')
        pasos.append(banco.conversar('1-caso9-tras-reiniciar-mcp'))
        original = v.PREGUNTA
        v.PREGUNTA = PREGUNTA_EXISTENTE
        try:
            pasos.append(banco.conversar('2-herramienta-existente'))
        except Exception as error:
            pasos.append({'etiqueta': '2-herramienta-existente', 'error': repr(error)})
            print(f'  [2-herramienta-existente] error: {error!r}')
        finally:
            v.PREGUNTA = original
        pasos.append(banco.conversar('3-caso9-otra-vez'))
    finally:
        banco.detener_todo()
    resumen = {
        'descripcion': 'B1 de la base arriba; solo mcp-server reiniciado con la rama.',
        'conversacion_previa_al_reinicio': not SIN_CONVERSACION_PREVIA,
        'pasos': [{k: p.get(k) for k in ('etiqueta', 'uso_la_herramienta', 'tool_calls', 'error')} for p in pasos],
    }
    (banco.evidencias / 'resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
