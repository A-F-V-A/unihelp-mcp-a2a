"""Incorpora los veredictos del juez a las corridas archivadas (decision 52).

    cd experiment && uv run python juez/incorporar.py --juez "claude-opus-5-5 (sesion Claude)"

1. Valida cada `juez/veredictos/lote-NNN.jsonl` contra su lote: mismos `id` en el
   mismo orden, numeros de punto y de prohibicion dentro de rango, `veredicto`
   `aprobado`/`reprobado`, `abstencion` booleana. Un lote mal formado se reporta y
   no se usa.
2. Deshace el cegado con `juez/clave-ciega.json`.
3. Solo en las corridas con TODAS sus ejecuciones juzgadas (un juez aplicado a
   media corrida sesgaria M1):
   - escribe `resultados/<corrida>/veredictos-juez.jsonl`
     (`insumos.schema.json#/$defs/veredictoJuez`);
   - actualiza `puntuaciones.jsonl`: `veredicto_juez` y
     `exito = compuerta_automatica AND veredicto == aprobado`. El juez solo puede
     QUITAR exito, nunca otorgarlo (RM-16);
   - deja `juez.json` con el juez, la huella del prompt y la fecha.

Despues hay que volver a correr el cuaderno sobre esas corridas.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
RESULTADOS = RAIZ.parent / 'resultados'
VEREDICTOS = ('aprobado', 'reprobado')


def leer_jsonl(ruta: Path) -> list[dict]:
    return [json.loads(l) for l in ruta.open(encoding='utf-8') if l.strip()]


def sin_numero(texto: str) -> str:
    """'2. Menciona el plazo' -> 'Menciona el plazo' (el texto exacto de la tarea)."""
    return texto.split('. ', 1)[1] if '. ' in texto and texto.split('. ', 1)[0].isdigit() else texto


def validar_lote(lote: list[dict], veredictos: list[dict]) -> list[str]:
    errores = []
    if [v.get('id') for v in veredictos] != [i['id'] for i in lote]:
        return ['los id no coinciden con el lote (faltan, sobran o cambiaron de orden)']
    for item, v in zip(lote, veredictos, strict=True):
        if v.get('veredicto') not in VEREDICTOS:
            errores.append(f"{v['id']}: veredicto {v.get('veredicto')!r}")
        if not isinstance(v.get('abstencion'), bool):
            errores.append(f"{v['id']}: abstencion no es booleana")
        for campo, lista in (('puntos_cubiertos', 'puntos_clave'), ('prohibiciones_violadas', 'prohibiciones')):
            numeros = v.get(campo)
            if not isinstance(numeros, list) or any(
                not isinstance(n, int) or isinstance(n, bool) or not 1 <= n <= len(item[lista]) for n in numeros
            ):
                errores.append(f"{v['id']}: {campo} fuera de rango {numeros!r}")
        # Coherencia de la regla de veredicto del prompt v1.
        completo = len(set(v.get('puntos_cubiertos') or [])) == len(item['puntos_clave'])
        limpio = not v.get('prohibiciones_violadas')
        if v.get('veredicto') == 'aprobado' and not (completo and limpio):
            errores.append(f"{v['id']}: aprobado sin cubrir todos los puntos o con prohibiciones violadas")
    return errores


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--juez', required=True, help='modelo o sesion que califico, tal como se reportara')
    args = parser.parse_args()

    clave = json.loads((RAIZ / 'clave-ciega.json').read_text(encoding='utf-8'))
    huella_prompt = 'sha256:' + hashlib.sha256((RAIZ / 'prompt-v1.md').read_bytes()).hexdigest()
    por_corrida: dict[str, dict[str, dict]] = defaultdict(dict)
    lotes_ok = lotes_malos = 0
    for ruta_lote in sorted((RAIZ / 'lotes').glob('lote-*.jsonl')):
        ruta_veredictos = RAIZ / 'veredictos' / ruta_lote.name
        if not ruta_veredictos.exists():
            continue
        lote = leer_jsonl(ruta_lote)
        try:
            veredictos = leer_jsonl(ruta_veredictos)
        except json.JSONDecodeError as error:
            print(f'{ruta_lote.name}: JSON mal formado ({error}); no se usa.')
            lotes_malos += 1
            continue
        errores = validar_lote(lote, veredictos)
        if errores:
            print(f'{ruta_lote.name}: {len(errores)} problemas; no se usa. Primero: {errores[0]}')
            lotes_malos += 1
            continue
        lotes_ok += 1
        for item, v in zip(lote, veredictos, strict=True):
            destino = clave[item['id']]
            por_corrida[destino['carpeta']][destino['run_id']] = {
                'run_id': destino['run_id'],
                'veredicto': v['veredicto'],
                'puntos_cubiertos': [sin_numero(item['puntos_clave'][n - 1]) for n in sorted(set(v['puntos_cubiertos']))],
                'prohibiciones_violadas': [
                    sin_numero(item['prohibiciones'][n - 1]) for n in sorted(set(v['prohibiciones_violadas']))
                ],
                'abstencion': v['abstencion'],
            }
    print(f'Lotes validos: {lotes_ok}; descartados: {lotes_malos}.')

    total_por_corrida: dict[str, int] = defaultdict(int)
    for destino in clave.values():
        total_por_corrida[destino['carpeta']] += 1
    for carpeta in sorted(total_por_corrida):
        juzgadas = por_corrida.get(carpeta, {})
        total = total_por_corrida[carpeta]
        if len(juzgadas) < total:
            print(f'  {carpeta}: {len(juzgadas)}/{total} juzgadas; se incorpora cuando este completa.')
            continue
        ruta = RESULTADOS / carpeta
        puntuaciones = leer_jsonl(ruta / 'puntuaciones.jsonl')
        quitados = 0
        for p in puntuaciones:
            v = juzgadas.get(p['run_id'])
            if v is None:
                continue
            compuerta = p.get('compuerta_automatica', p['exito'])
            p['compuerta_automatica'] = compuerta
            p['veredicto_juez'] = v['veredicto']
            nuevo = bool(compuerta) and v['veredicto'] == 'aprobado'
            quitados += p['exito'] and not nuevo
            p['exito'] = nuevo
        with (ruta / 'puntuaciones.jsonl').open('w', encoding='utf-8', newline='\n') as archivo:
            for p in puntuaciones:
                archivo.write(json.dumps(p, ensure_ascii=False) + '\n')
        orden = [p['run_id'] for p in puntuaciones if p['run_id'] in juzgadas]
        with (ruta / 'veredictos-juez.jsonl').open('w', encoding='utf-8', newline='\n') as archivo:
            for run_id in orden:
                archivo.write(json.dumps(juzgadas[run_id], ensure_ascii=False) + '\n')
        (ruta / 'juez.json').write_text(json.dumps({
            'juez': args.juez,
            'prompt': 'experiment/juez/prompt-v1.md',
            'huella_prompt': huella_prompt,
            'incorporado_el': date.today().isoformat(),
            'ejecuciones_juzgadas': len(juzgadas),
            'aprobadas': sum(v['veredicto'] == 'aprobado' for v in juzgadas.values()),
            'exitos_quitados_por_el_juez': int(quitados),
        }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'  {carpeta}: {total}/{total} incorporadas; el juez quito {quitados} exitos de la compuerta.')


if __name__ == '__main__':
    main()
