"""Arma el paquete final de datos del experimento: todas las corridas archivadas,
clasificadas, consolidadas en tablas planas, con catalogo de metricas y README.

    cd experiment && uv run python resultados/paquete.py [--fecha 2026-09-27]

Escribe `resultados-finales/unihelp-datos-experimento-<fecha>/` y su `.zip`.

Este script NO calcula metricas (RM-02): copia los datos crudos, los aplana a
CSV campo por campo y transcribe las metricas que el cuaderno ya dejo en cada
`resultados.json`. La clasificacion de corridas es descriptiva (cobertura de la
matriz); que corridas entran al analisis oficial lo decide el equipo (RM-17).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import subprocess
import zipfile
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import yaml

RAIZ_EXP = Path(__file__).resolve().parent.parent
RAIZ_REPO = RAIZ_EXP.parent
RESULTADOS = RAIZ_EXP / 'resultados'
DESTINO = RAIZ_EXP / 'resultados-finales'

# --- Clasificacion de las corridas -------------------------------------------------------------

PRINCIPAL = 'A-principal'
PARCIAL = 'B-parcial'
HISTORICO = 'C-historico'

CLASES = {
    PRINCIPAL: 'Matriz completa (todas las ejecuciones planificadas con traza valida), cuatro '
    'arquitecturas, codigo con B0-B3 implementados y prompt base 1.4.0. Admite los cuatro contrastes.',
    PARCIAL: 'Campaña interrumpida por el proveedor (402, saldo agotado): las trazas son validas una '
    'por una, pero la matriz esta incompleta. Sus contrastes usan solo las tareas pareadas disponibles.',
    HISTORICO: 'Linea base de B0 sola, anterior a B1-B3 o con prompt anterior. No admite contrastes '
    'entre arquitecturas; documenta la evolucion del agente.',
}


def clasificar(carpeta: str, manifiesto: dict) -> str:
    if manifiesto.get('interrumpida'):
        return PARCIAL
    arqs = manifiesto.get('arquitecturas') or []
    if len(arqs) == 4 and manifiesto.get('trazas_validas') == manifiesto.get('ejecuciones'):
        return PRINCIPAL
    return HISTORICO


def proveedor_de(modelo: str) -> str:
    if modelo.startswith('gemini'):
        return 'gemini'
    if modelo.startswith('unihelp-qwen') or 'qwen' in modelo:
        return 'ollama'
    return 'openai'


# --- Disponibilidad de cada metrica ------------------------------------------------------------

# Por que una metrica no esta calculada. Se verifica contra los datos mas abajo.
SITUACION = {
    'calculada': 'Calculada por el cuaderno en cada corrida (ver consolidado/metricas-calculadas.csv).',
    'crudo_disponible': 'Los campos que necesita YA estan en las trazas o en las tareas; falta '
    'implementar la funcion de calculo en el cuaderno (familia fuera del alcance de la primera entrega).',
    'falta_insumo': 'Necesita un insumo que ninguna corrida produjo todavia (juez, revisores humanos, '
    'microbenchmark, reproduccion, corrida de control o experimento de extensibilidad).',
}

FALTA = {
    'M3.2': 'veredictos del juez LLM (veredictos-juez.jsonl)',
    'M3.3': 'veredictos del juez LLM (veredictos-juez.jsonl)',
    'M3.4': 'veredictos del juez LLM (veredictos-juez.jsonl)',
    'M4.3': 'microbenchmark de transporte sin modelo (bench-transport.json, D9)',
    'M6.1': 'experimento de extensibilidad: commit aislado de la sexta herramienta',
    'M6.2': 'experimento de extensibilidad: commit aislado de la sexta herramienta',
    'M6.3': 'experimento de extensibilidad: bitacora de servicios reiniciados',
    'M6.4': 'experimento de extensibilidad: minutos hasta prueba verde',
    'M6.5': 'experimento de extensibilidad: resultado de la suite en el commit aislado',
    'M7.4': 'planilla de dos revisores humanos sobre el 20 % de las ejecuciones',
    'M7.5': 'veredictos del juez y planilla humana adjudicada',
    'M7.6': 'reproduccion de la corrida desde casetes (modo replay)',
    'M7.7': 'corrida de control con instrumentacion completa y minima',
}

NOTAS = {
    'M4.7': 'Tokens de la traza x tarifa de lista de experiment/tarifas.yaml (decision 50, consultada el '
    '2026-09-27). Las corridas historicas sin trazas conservan su calculo anterior (0).',
    'M1.1': 'exito = compuerta automatica AND veredicto del juez (Claude, prompt v2, decision 53). El juez '
    'solo puede quitar exito (RM-16); en las corridas historicas sin trazas sigue siendo solo la compuerta.',
    'M3.2': 'Se reporta contra todos los puntos clave y, aparte (puntos=con_respaldo), contra los que si '
    'llegaron al agente: buscar_politica devuelve un extracto por politica (decision 53).',
    'M3.5': 'Se mide sobre las 5 tareas que declaran esperado.ticket.prioridad; el plan habla de 20 '
    '(decision 51, pendiente).',
    'M5.2': 'Sin valor en todas las corridas: ningun agente intento crear sin token valido.',
    'M5.4': 'Sin datos en Qwen2.5 7B: casi nunca pidio confirmacion y nadie llego a otorgarla.',
    'M5.6': 'Se mide con tool_calls[] y los permisos por rol (el rechazo no deja evento de auditoria). '
    'Sin valor en todas las corridas: ningun agente intento una herramienta fuera de su rol.',
}


def valores_en(obj, ruta: str):
    """Recorre `a.b[].c` y devuelve la lista de valores encontrados (sin interpretar)."""
    actuales = [obj]
    for parte in ruta.split('.'):
        lista = parte.endswith('[]')
        clave = parte[:-2] if lista else parte
        siguientes = []
        for a in actuales:
            if not isinstance(a, dict) or clave not in a:
                continue
            v = a[clave]
            if lista:
                siguientes.extend(v if isinstance(v, list) else [])
            else:
                siguientes.append(v)
        actuales = siguientes
    return actuales


# --- Utilidades --------------------------------------------------------------------------------


def jsonl(ruta: Path) -> list[dict]:
    if not ruta.exists():
        return []
    return [json.loads(l) for l in ruta.open(encoding='utf-8') if l.strip()]


def leer(ruta: Path) -> dict:
    return json.loads(ruta.read_text(encoding='utf-8')) if ruta.exists() else {}


def escribir_csv(ruta: Path, filas: list[dict], columnas: list[str]) -> int:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    # utf-8 con BOM para que Excel en Windows respete tildes; separador coma, decimal punto.
    with ruta.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=columnas, extrasaction='ignore')
        w.writeheader()
        for fila in filas:
            w.writerow({k: ('' if fila.get(k) is None else fila.get(k)) for k in columnas})
    return len(filas)


def partes_run_id(run_id: str) -> tuple[str, str, int]:
    tarea, arq, rep, *_ = run_id.split('|')
    return tarea, arq, int(rep.lstrip('r'))


def dims(d: dict | None) -> str:
    return ';'.join(f'{k}={v}' for k, v in sorted((d or {}).items()))


def num(v, dec=1):
    if v is None:
        return '—'
    return f'{v:,.{dec}f}'.replace(',', ' ')


# --- Programa ----------------------------------------------------------------------------------


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--fecha', default=date.today().isoformat())
    args = ap.parse_args()

    nombre = f'unihelp-datos-experimento-{args.fecha}'
    base = DESTINO / nombre
    if base.exists():
        shutil.rmtree(base)
    base.mkdir(parents=True)

    registro = yaml.safe_load((RAIZ_EXP / 'metricas.yaml').read_text(encoding='utf-8'))
    tareas = {}
    for f in sorted((RAIZ_REPO / 'docs' / 'tasks').glob('T-*.yaml')):
        t = yaml.safe_load(f.read_text(encoding='utf-8'))
        tareas[t['id']] = t

    commit = subprocess.run(
        ['git', 'rev-parse', '--short=12', 'HEAD'], cwd=RAIZ_REPO, capture_output=True, text=True
    ).stdout.strip()

    corridas, ejecuciones, herramientas, saltos, cuarentena = [], [], [], [], []
    metricas_calc, contrastes, estados_metrica = [], [], []
    trazas_principales = []

    for carpeta in sorted(p for p in RESULTADOS.iterdir() if p.is_dir()):
        m = leer(carpeta / 'manifiesto.json')
        res = leer(carpeta / 'resultados.json')
        trazas = jsonl(carpeta / 'trazas.jsonl')
        puntos = {p['run_id']: p for p in jsonl(carpeta / 'puntuaciones.jsonl')}
        cuar = jsonl(carpeta / 'cuarentena' / 'trazas.jsonl')
        clase = clasificar(carpeta.name, m)
        modelo = (
            trazas[0]['provenance']['modelo_id'] if trazas else (res.get('corrida') or {}).get('modelo_id', '—')
        )
        if clase == PRINCIPAL:
            trazas_principales.extend(trazas)

        # Copia integra de la carpeta: los datos crudos no se tocan.
        shutil.copytree(carpeta, base / 'datos' / clase / carpeta.name)

        interr = m.get('interrumpida') or {}
        ejec_cuaderno = ((res.get('corrida') or {}).get('ejecuciones') or {})
        esfuerzo = interr.get('reasoning_effort') or ('low' if 'low' in carpeta.name else ('none' if modelo.startswith('gemini') else ''))
        tareas_por_arq = defaultdict(set)
        for t in trazas:
            tareas_por_arq[t['condition']].add(t['task_id'])
        comunes = set.intersection(*tareas_por_arq.values()) if len(tareas_por_arq) == 4 else set()
        corridas.append(
            {
                'carpeta': carpeta.name,
                'clasificacion': clase,
                'proveedor': proveedor_de(modelo),
                'modelo_id': modelo,
                'reasoning_effort': esfuerzo,
                'arquitecturas': ','.join(m.get('arquitecturas') or sorted(tareas_por_arq)),
                'repeticiones': m.get('repeticiones'),
                'ejecuciones_planificadas': interr.get('planificadas') or m.get('ejecuciones') or len(trazas or puntos) or ejec_cuaderno.get('intentadas'),
                'ejecuciones_intentadas': m.get('ejecuciones') or len(trazas or puntos) or ejec_cuaderno.get('intentadas'),
                'trazas_validas': m.get('trazas_validas') if m.get('trazas_validas') is not None else (len(trazas) or ejec_cuaderno.get('validas')),
                'en_cuarentena': m.get('en_cuarentena'),
                'compuerta_superada': m.get('compuerta_superada') if m.get('compuerta_superada') is not None else (sum(1 for q in puntos.values() if q.get('exito')) if puntos else None),
                'trazas_en_archivo': len(trazas),
                'tareas_B0': len(tareas_por_arq.get('B0', ())),
                'tareas_B1': len(tareas_por_arq.get('B1', ())),
                'tareas_B2': len(tareas_por_arq.get('B2', ())),
                'tareas_B3': len(tareas_por_arq.get('B3', ())),
                'tareas_en_las_cuatro': len(comunes),
                'semilla': m.get('semilla'),
                'modo_llm': m.get('modo_llm'),
                'version_codigo': m.get('version_codigo'),
                'config_hash': m.get('config_hash'),
                'generado_en': m.get('generado_en'),
                'interrumpida_motivo': interr.get('motivo', ''),
            }
        )

        # Ejecuciones: una fila por traza; si la carpeta no trae trazas, por puntuacion.
        filas_base = trazas or [{'run_id': rid} for rid in puntos]
        for t in filas_base:
            rid = t['run_id']
            tarea, arq, rep = (t['task_id'], t['condition'], t['repetition']) if 'task_id' in t else partes_run_id(rid)
            p = puntos.get(rid, {})
            tm = t.get('timing') or {}
            br = tm.get('breakdown') or {}
            us = t.get('usage') or {}
            out = t.get('outcome') or {}
            fj = out.get('final_json') or {}
            diag = fj.get('diagnostico') or {}
            prov = t.get('provenance') or {}
            a2a = t.get('a2a') or {}
            tc = t.get('tool_calls') or []
            ejecuciones.append(
                {
                    'clasificacion': clase,
                    'carpeta': carpeta.name,
                    'proveedor': proveedor_de(modelo),
                    'modelo_id': prov.get('modelo_id', modelo),
                    'run_id': rid,
                    'trace_id': t.get('trace_id'),
                    'task_id': tarea,
                    'categoria': (tareas.get(tarea) or {}).get('categoria'),
                    'arquitectura': arq,
                    'repeticion': rep,
                    'outcome_status': out.get('status'),
                    'exito': p.get('exito'),
                    'compuerta_automatica': p.get('compuerta_automatica'),
                    'veredicto_juez': p.get('veredicto_juez'),
                    'motivos_fallo': ';'.join(p.get('motivos') or []),
                    'started_at': tm.get('started_at'),
                    'ended_at': tm.get('ended_at'),
                    'total_ms': tm.get('total_ms'),
                    'llm_ms': br.get('llm_ms'),
                    'tool_exec_ms': br.get('tool_exec_ms'),
                    'transport_ms': br.get('transport_ms'),
                    'orchestration_ms': br.get('orchestration_ms'),
                    'input_tokens': us.get('input_tokens'),
                    'output_tokens': us.get('output_tokens'),
                    'cached_input_tokens': us.get('cached_input_tokens'),
                    'llm_calls': us.get('llm_calls'),
                    'cost_usd_est': us.get('cost_usd_est'),
                    'a2a_mensajes_totales': a2a.get('mensajes_totales'),
                    'a2a_saltos_registrados': len(a2a.get('hops') or []) if t.get('a2a') is not None else None,
                    'tool_calls_registradas': len(tc) if 'tool_calls' in t else None,
                    'herramientas_en_orden': '>'.join(c['nombre'] for c in tc),
                    'final_clasificacion': fj.get('clasificacion'),
                    'final_confianza': fj.get('confianza'),
                    'final_politicas_citadas': ';'.join(fj.get('politicas_citadas') or []),
                    'final_servicio': diag.get('servicio'),
                    'final_estado_servicio': diag.get('estado'),
                    'final_prioridad': diag.get('prioridad'),
                    'confirmacion_solicitada': out.get('confirmacion_solicitada'),
                    'confirmacion_otorgada': out.get('confirmacion_otorgada'),
                    'tickets_creados': ';'.join(out.get('tickets_creados') or []),
                    'errores': ';'.join(e.get('mensaje', '') for e in t.get('errors') or []),
                    'state_hash_inicial': prov.get('state_hash_inicial'),
                    'semilla': prov.get('semilla'),
                    'version_codigo': prov.get('version_codigo'),
                    'llm_mode': prov.get('llm_mode'),
                    'temperatura': (t.get('model') or {}).get('temperature'),
                    'dataset_version': prov.get('dataset_version'),
                }
            )
            for c in tc:
                herramientas.append(
                    {
                        'clasificacion': clase,
                        'carpeta': carpeta.name,
                        'modelo_id': modelo,
                        'run_id': rid,
                        'task_id': tarea,
                        'arquitectura': arq,
                        'repeticion': rep,
                        'seq': c.get('seq'),
                        'nombre': c.get('nombre'),
                        'agente': c.get('agente'),
                        'transporte': c.get('transporte'),
                        'isError': c.get('isError'),
                        'resultado_status': c.get('resultado_status'),
                        'latency_ms': c.get('latency_ms'),
                        'args_json': json.dumps(c.get('args'), ensure_ascii=False),
                    }
                )
            for h in a2a.get('hops') or []:
                saltos.append(
                    {
                        'clasificacion': clase,
                        'carpeta': carpeta.name,
                        'modelo_id': modelo,
                        'run_id': rid,
                        'task_id': tarea,
                        'arquitectura': arq,
                        'repeticion': rep,
                        **{k: h.get(k) for k in ('n', 'de', 'a', 'habilidad', 'estado', 'rtt_ms', 'procesamiento_receptor_ms', 'transport_ms', 't_emision', 't_recepcion')},
                    }
                )

        for r in cuar:
            t = r.get('traza') or {}
            cuarentena.append(
                {
                    'clasificacion': clase,
                    'carpeta': carpeta.name,
                    'modelo_id': modelo,
                    'run_id': t.get('run_id'),
                    'task_id': t.get('task_id'),
                    'arquitectura': t.get('condition'),
                    'repeticion': t.get('repetition'),
                    'estado_original': r.get('estado_original'),
                    'errores_validacion': ';'.join(r.get('errores') or []),
                    'errores_traza': ';'.join(e.get('mensaje', '') for e in t.get('errors') or []),
                }
            )

        # Metricas: transcripcion literal de lo que calculo el cuaderno.
        for met in res.get('metricas') or []:
            estados_metrica.append({'carpeta': carpeta.name, 'codigo': met['codigo'], 'estado': met.get('estado')})
            comun = {
                'clasificacion': clase,
                'carpeta': carpeta.name,
                'modelo_id': modelo,
                'codigo': met['codigo'],
                'familia': met.get('familia'),
                'nombre': met.get('nombre'),
                'unidad': met.get('unidad'),
                'direccion': met.get('direccion'),
                'tipo_valor_esperado': met.get('tipo_valor_esperado'),
            }
            for f in met.get('filas') or []:
                i = f.get('intervalo') or {}
                metricas_calc.append(
                    {
                        **comun,
                        'estado': met.get('estado'),
                        'arquitectura': f.get('arquitectura'),
                        'estadistico': f.get('estadistico'),
                        'dimensiones': dims(f.get('dimensiones')),
                        'valor': f.get('valor'),
                        'ic_inferior': i.get('inferior'),
                        'ic_superior': i.get('superior'),
                        'nivel': i.get('nivel'),
                        'n_tareas': f.get('n_tareas'),
                        'n_observaciones': f.get('n_observaciones'),
                    }
                )
            for c in met.get('contrastes') or []:
                i = c.get('intervalo') or {}
                contrastes.append(
                    {
                        **comun,
                        'contraste': f"{c.get('minuendo')}-{c.get('sustraendo')}",
                        'estadistico': c.get('estadistico'),
                        'dimensiones': dims(c.get('dimensiones')),
                        'diferencia': c.get('diferencia'),
                        'ic_inferior': i.get('inferior'),
                        'ic_superior': i.get('superior'),
                        'nivel': i.get('nivel'),
                        'n_tareas': c.get('n_tareas'),
                        'incluye_cero': (
                            None
                            if i.get('inferior') is None
                            else (i['inferior'] <= 0 <= i['superior'])
                        ),
                    }
                )

    # --- Catalogo de metricas con disponibilidad verificada ------------------------------------
    estado_en_datos = defaultdict(Counter)
    for e in estados_metrica:
        estado_en_datos[e['codigo']][e['estado']] += 1
    muestra = trazas_principales
    catalogo = []
    for met in registro['metricas']:
        cod = met['codigo']
        faltantes, presentes = [], []
        for fu in met.get('fuente') or []:
            for campo in (fu.get('campos') or {}).values():
                etiqueta = f"{fu['artefacto']}:{campo}"
                if fu['artefacto'] == 'traza':
                    base_ruta = campo
                    hay = any(v not in (None, [], '') for t in muestra for v in valores_en(t, base_ruta))
                    # Campos de listas pueden estar vacios en una traza y presentes en otra.
                    (presentes if hay else faltantes).append(etiqueta)
                elif fu['artefacto'] == 'tareas':
                    hay = any(valores_en(t, campo) not in ([], [None]) for t in tareas.values())
                    (presentes if hay else faltantes).append(etiqueta)
                elif fu['artefacto'] in ('puntuaciones', 'validacion', 'huellas_esperadas'):
                    presentes.append(etiqueta)
                else:
                    faltantes.append(etiqueta)
        calc = estado_en_datos[cod].get('calculada', 0)
        if calc:
            situacion = 'calculada'
        elif cod in FALTA:
            situacion = 'falta_insumo'
        else:
            situacion = 'crudo_disponible'
        catalogo.append(
            {
                'codigo': cod,
                'familia': met['familia'],
                'nombre': met['nombre'],
                'rol': met.get('rol'),
                'hipotesis': ','.join(met.get('hipotesis') or []),
                'situacion': situacion,
                'estado_registro': met['implementacion']['estado'],
                'corridas_donde_esta_calculada': calc,
                'que_falta': FALTA.get(cod, 'implementar la funcion en experiment/analisis/familias/' if situacion == 'crudo_disponible' else ''),
                'nota': NOTAS.get(cod, ''),
                'campos_fuente_presentes': ' | '.join(presentes),
                'campos_fuente_ausentes': ' | '.join(faltantes),
                'que_se_espera_medir': met.get('que_se_espera_medir'),
                'como_se_mide': met.get('como_se_mide'),
                'formula': met.get('formula'),
                'unidad': (met.get('unidad_y_direccion') or {}).get('unidad'),
                'direccion': (met.get('unidad_y_direccion') or {}).get('direccion'),
                'unidad_analisis': met.get('unidad_analisis'),
                'agregacion': met.get('agregacion'),
                'tipo_valor_esperado': met.get('tipo_valor_esperado'),
                'valor_umbral': json.dumps(met.get('valor_umbral'), ensure_ascii=False) if met.get('valor_umbral') is not None else '',
                'que_no_captura': met.get('que_no_captura'),
            }
        )

    tareas_filas = [
        {
            'task_id': t['id'],
            'categoria': t.get('categoria'),
            'titulo': t.get('titulo'),
            'servicios': ';'.join(t.get('servicios') or []),
            'ejes': ';'.join(t.get('ejes') or []),
            'arquitecturas': ';'.join(t.get('arquitecturas') or []),
            'turnos_usuario': len(t.get('conversacion') or []),
        }
        for t in tareas.values()
    ]

    # --- Escritura -----------------------------------------------------------------------------
    c = base / 'consolidado'
    n = {}
    n['ejecuciones'] = escribir_csv(c / 'ejecuciones.csv', ejecuciones, list(ejecuciones[0].keys()))
    n['herramientas'] = escribir_csv(c / 'llamadas-herramientas.csv', herramientas, list(herramientas[0].keys()))
    n['saltos'] = escribir_csv(c / 'saltos-a2a.csv', saltos, list(saltos[0].keys()))
    n['cuarentena'] = escribir_csv(c / 'cuarentena.csv', cuarentena, list(cuarentena[0].keys()))
    n['metricas'] = escribir_csv(c / 'metricas-calculadas.csv', metricas_calc, list(metricas_calc[0].keys()))
    n['contrastes'] = escribir_csv(c / 'contrastes.csv', contrastes, list(contrastes[0].keys()))
    cat = base / 'catalogo'
    escribir_csv(cat / 'corridas.csv', corridas, list(corridas[0].keys()))
    escribir_csv(cat / 'metricas.csv', catalogo, list(catalogo[0].keys()))
    escribir_csv(cat / 'tareas.csv', tareas_filas, list(tareas_filas[0].keys()))
    shutil.copy(RAIZ_EXP / 'metricas.yaml', cat / 'metricas.yaml')
    shutil.copy(RAIZ_EXP / 'tarifas.yaml', cat / 'tarifas.yaml')
    shutil.copytree(RAIZ_EXP / 'schemas', cat / 'esquemas', ignore=shutil.ignore_patterns('ejemplos'))
    shutil.copytree(RAIZ_REPO / 'docs' / 'tasks', base / 'tareas')
    inf = base / 'informes'
    inf.mkdir()
    for d in sorted((RAIZ_REPO / 'docs').glob('resultados-*.md')):
        shutil.copy(d, inf / d.name)
    for extra in ('09-plan-de-medicion.md', 'historias-de-usuario-medicion.md'):
        shutil.copy(RAIZ_REPO / 'docs' / extra, inf / extra)
    shutil.copy(RESULTADOS / 'README.md', inf / 'guia-resultados-archivados.md')

    readme = componer_readme(args.fecha, commit, corridas, catalogo, ejecuciones, cuarentena, n, metricas_calc, contrastes)
    (base / 'README.md').write_text(readme, encoding='utf-8')

    # Huellas para comprobar que nada se altero al copiar o descomprimir.
    sumas = []
    for f in sorted(p for p in base.rglob('*') if p.is_file()):
        sumas.append(f'{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.relative_to(base).as_posix()}')
    (base / 'SHA256SUMS.txt').write_text('\n'.join(sumas) + '\n', encoding='utf-8')

    zip_ruta = DESTINO / f'{nombre}.zip'
    if zip_ruta.exists():
        zip_ruta.unlink()
    with zipfile.ZipFile(zip_ruta, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(p for p in base.rglob('*') if p.is_file()):
            z.write(f, f'{nombre}/{f.relative_to(base).as_posix()}')
    print(f'{len(sumas)} archivos; zip {zip_ruta.stat().st_size / 1e6:.1f} MB -> {zip_ruta}')
    print(json.dumps(n))


# --- README ------------------------------------------------------------------------------------


def tabla(cabecera: list[str], filas: list[list]) -> str:
    out = ['| ' + ' | '.join(cabecera) + ' |', '| ' + ' | '.join('---' for _ in cabecera) + ' |']
    out += ['| ' + ' | '.join('' if v is None else str(v) for v in f) + ' |' for f in filas]
    return '\n'.join(out)


def componer_readme(fecha, commit, corridas, catalogo, ejecuciones, cuarentena, n, metricas_calc, contrastes) -> str:
    por_clase = Counter(e['clasificacion'] for e in ejecuciones)
    trazas_clase = Counter(e['clasificacion'] for e in ejecuciones if e['trace_id'])
    sit = Counter(m['situacion'] for m in catalogo)

    tabla_corridas = tabla(
        ['Clase', 'Carpeta', 'Modelo', 'Esfuerzo', 'Validas / planificadas', 'Compuerta', 'Tareas B0/B1/B2/B3', 'En las 4'],
        [
            [
                c['clasificacion'],
                f"`{c['carpeta']}`",
                c['modelo_id'],
                c['reasoning_effort'] or '—',
                f"{c['trazas_validas']} / {c['ejecuciones_planificadas']}",
                c['compuerta_superada'] if c['compuerta_superada'] is not None else '—',
                f"{c['tareas_B0']}/{c['tareas_B1']}/{c['tareas_B2']}/{c['tareas_B3']}" if c['trazas_en_archivo'] else '— (sin trazas)',
                c['tareas_en_las_cuatro'] or '—',
            ]
            for c in sorted(corridas, key=lambda c: (c['clasificacion'], c['carpeta']))
        ],
    )

    def fila_met(m):
        return [m['codigo'], m['nombre'], m['rol'], m['hipotesis'] or '—', m['que_falta'] or '—']

    grupos = {s: [fila_met(m) for m in catalogo if m['situacion'] == s] for s in SITUACION}

    # Cifras principales: M1.1, M4.1 y M4.6 por corrida y arquitectura, y contrastes de M1.1.
    def valor(carpeta, cod, arq, est, dimensiones=''):
        for r in metricas_calc:
            if r['carpeta'] == carpeta and r['codigo'] == cod and r['arquitectura'] == arq and r['estadistico'] == est and r['dimensiones'] == dimensiones:
                return r
        return None

    def contraste(carpeta, cod, par, dimensiones=''):
        for r in contrastes:
            if r['carpeta'] == carpeta and r['codigo'] == cod and r['contraste'] == par and r['dimensiones'] == dimensiones:
                return r
        return None

    def ic(r, esc=1.0, dec=1, con_n=False):
        if not r or r.get('valor') is None and r.get('diferencia') is None:
            return '—'
        v = r['valor'] if r.get('valor') is not None else r['diferencia']
        s = f'{v * esc:+.{dec}f}' if 'diferencia' in r else f'{v * esc:.{dec}f}'
        if r.get('ic_inferior') is not None:
            s += f" [{r['ic_inferior'] * esc:.{dec}f}; {r['ic_superior'] * esc:.{dec}f}]"
        if con_n and r.get('n_tareas'):
            s += f" n={r['n_tareas']}"
        return s

    filas_efect, filas_contr, filas_costo, filas_nuevas = [], [], [], []
    for c in sorted(corridas, key=lambda c: (c['clasificacion'], c['carpeta'])):
        if c['clasificacion'] == HISTORICO:
            continue
        k = c['carpeta']
        etiqueta = (
            f"{c['modelo_id']}{' (' + c['reasoning_effort'] + ')' if c['reasoning_effort'] else ''}, {k[:10]}"
            f"{', 1 rep.' if k.endswith('-r1') else ''}"
            f"{', *parcial ' + str(c['trazas_validas']) + '/' + str(c['ejecuciones_planificadas']) + '*' if c['clasificacion'] == PARCIAL else ''}"
        )
        filas_efect.append([etiqueta] + [ic(valor(k, 'M1.1', a, 'media_entre_tareas'), 100, 1, c['clasificacion'] == PARCIAL) for a in ('B0', 'B1', 'B2', 'B3')])
        filas_contr.append([etiqueta] + [ic(contraste(k, 'M1.1', p), 100, 1, True) for p in ('B1-B0', 'B2-B1', 'B3-B2', 'B3-B1')])
        def cuatro(cod, k=k):
            celdas = []
            for a in ('B0', 'B1', 'B2', 'B3'):
                v = valor(k, cod, a, 'media_entre_tareas')
                celdas.append('—' if not v or v['valor'] is None else f"{v['valor'] * 100:.0f}")
            return ' / '.join(celdas)

        def total(cod, est, dec, k=k):
            v = valor(k, cod, None, est)
            return '—' if not v or v['valor'] is None else f"{v['valor']:.{dec}f}"

        filas_nuevas.append(
            [etiqueta, cuatro('M2.2'), cuatro('M3.1'), cuatro('M5.3'), total('M5.1', 'conteo', 0),
             total('M4.7', 'suma_corrida', 2)]
        )
        filas_costo.append(
            [etiqueta]
            + [
                f"{ic(valor(k, 'M4.1', a, 'mediana_entre_tareas'), 1, 0).split(' ')[0]} ms / "
                f"{ic(valor(k, 'M4.4', a, 'mediana_entre_tareas'), 1, 0).split(' ')[0]} llam."
                for a in ('B0', 'B1', 'B2', 'B3')
            ]
        )

    seccion_crudo = (
        tabla(['Codigo', 'Metrica', 'Rol', 'Hipotesis', 'Que falta'], grupos['crudo_disponible'])
        if grupos['crudo_disponible']
        else 'Ninguna. Las 16 que tenian sus datos en las trazas (M2.1-M2.6, M3.1, M3.5, M3.6 y M5.1-M5.7) '
        'se implementaron el 27 de septiembre de 2026 y se recalcularon sobre todas las corridas sin volver a '
        'ejecutar ninguna tarea (decision 51).'
    )

    return f"""# UniHelp: paquete de datos del experimento ({fecha})

Todos los datos crudos que el experimento produjo hasta el {fecha}, **clasificados**
por lo que sirven para el analisis, **consolidados** en tablas planas y
acompañados del **catalogo de las 43 metricas** del plan de medicion con lo que
ya esta calculado, lo que se puede calcular con estos datos y lo que falta.

- Generado por `experiment/resultados/paquete.py` sobre el commit `{commit}` del
  repositorio (se regenera identico con `uv run python resultados/paquete.py --fecha {fecha}`).
- Fuente: `experiment/resultados/` (corridas archivadas y versionadas, decision 47).
- Este paquete **no calcula metricas** (regla RM-02): las cifras de metricas son
  transcripcion literal de los `resultados.json` que produjo el cuaderno
  `experiment/analisis.ipynb`; las tablas de `consolidado/` son los campos crudos
  de cada traza aplanados, sin agregar.
- La integridad de cada archivo se comprueba con `SHA256SUMS.txt`
  (`sha256sum -c SHA256SUMS.txt`).

---

## 1. Resumen en cifras

| Concepto | Cantidad |
| --- | --- |
| Corridas archivadas | {len(corridas)} ({sum(c['clasificacion'] == PRINCIPAL for c in corridas)} principales, {sum(c['clasificacion'] == PARCIAL for c in corridas)} parciales, {sum(c['clasificacion'] == HISTORICO for c in corridas)} historicas) |
| Ejecuciones con resultado (filas de `ejecuciones.csv`) | {n['ejecuciones']:,} ({por_clase[PRINCIPAL]:,} principales, {por_clase[PARCIAL]:,} parciales, {por_clase[HISTORICO]:,} historicas) |
| Trazas completas (con tiempos, tokens y herramientas) | {sum(trazas_clase.values()):,} |
| Llamadas a herramientas registradas | {n['herramientas']:,} |
| Saltos entre agentes (B2 en proceso, B3 por A2A) | {n['saltos']:,} |
| Ejecuciones en cuarentena (fallo de infraestructura, excluidas) | {n['cuarentena']:,} |
| Filas de metricas calculadas / contrastes | {n['metricas']:,} / {n['contrastes']:,} |
| Metricas del plan | 43: {sit['calculada']} calculadas, {sit['crudo_disponible']} con datos crudos ya disponibles, {sit['falta_insumo']} a las que les falta un insumo |
| Tareas del conjunto de evaluacion | 40 (10 informativas, 10 de diagnostico, 10 compuestas, 10 adversariales) |
| Modelos | OpenAI gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-4.1-mini; Ollama Qwen2.5 7B local; Gemini 3.8-flash, 3.5-flash, 3.1-flash-lite, 3.1-pro-preview |

---

## 2. Que hay en el zip

```text
README.md                    este documento
SHA256SUMS.txt               huella SHA-256 de cada archivo del paquete
catalogo/
  corridas.csv               una fila por corrida: clase, modelo, cobertura, commit, semilla
  metricas.csv               las 43 metricas: definicion, formula, situacion, campos presentes/ausentes
  tareas.csv                 las 40 tareas: categoria, servicios, ejes
  metricas.yaml              registro oficial de metricas (fuente de todo nombre de campo)
  tarifas.yaml               tarifa de lista por modelo con su fuente y fecha (costo M4.7)
  esquemas/                  JSON Schema de traza, insumos, metricas y resultados
consolidado/                 TODO el experimento en tablas planas (CSV UTF-8 con BOM)
  ejecuciones.csv            una fila por ejecucion (unidad de observacion)
  llamadas-herramientas.csv  una fila por llamada a herramienta dentro de una ejecucion
  saltos-a2a.csv             una fila por delegacion orquestador -> especialista (B2, B3)
  cuarentena.csv             ejecuciones apartadas por fallo de infraestructura
  metricas-calculadas.csv    cada valor que calculo el cuaderno, con su intervalo y su n
  contrastes.csv             cada contraste entre arquitecturas, con intervalo y si incluye el cero
datos/                       copia INTEGRA de cada corrida, separada por clase
  A-principal/<corrida>/     matrices completas: la base del analisis
  B-parcial/<corrida>/       campañas Gemini cortadas por saldo
  C-historico/<corrida>/     lineas base de B0 anteriores a B1-B3
tareas/                      los 40 YAML de docs/tasks (respuesta esperada de cada tarea)
informes/                    informes de resultados de cada campaña, plan de medicion (docs/09),
                             historias de medicion y guia de las carpetas archivadas
```

Dentro de cada carpeta de `datos/`:

| Archivo | Formato | Que es |
| --- | --- | --- |
| `trazas.jsonl` | JSON Lines, una traza por linea, valida contra `catalogo/esquemas/traza.schema.json` | **El dato crudo principal.** Todo lo que paso en una ejecucion |
| `puntuaciones.jsonl` | JSON Lines, clave `run_id` | `exito` (compuerta AND juez), `compuerta_automatica`, `veredicto_juez` y `motivos` de fallo de la compuerta |
| `veredictos-juez.jsonl` | JSON Lines, clave `run_id` | Juez: `veredicto`, `puntos_cubiertos`, `puntos_sin_respaldo`, `prohibiciones_violadas`, `abstencion` |
| `juez.json` | JSON | Quien juzgo, huella del prompt, aprobadas, exitos quitados, reprobadas solo por falta de respaldo, consistencia con la pasada v1 |
| `cuarentena/trazas.jsonl` | JSON Lines: `traza`, `errores`, `estado_original` | Ejecuciones que no se cuentan (RM-15) |
| `manifiesto.json` | JSON | Procedencia: commit, semilla, modo, conteos, fallos de infraestructura; bloque `interrumpida` en las parciales |
| `manifiesto-cuaderno.json` | JSON | Procedencia de la ejecucion del cuaderno |
| `huellas-esperadas.json` | JSON | Huella del estado inicial esperada por tarea (M7.2) |
| `resultados.json` | JSON, valido contra `resultados.schema.json` | **Las metricas calculadas** de esa corrida |
| `tabla_1/2/4/7.csv`, `figura_1..4.svg` | CSV / SVG | Tablas y figuras del cuaderno (efectividad, latencia, costo, control) |
| `reejecuciones.md` | Markdown | Registro de reejecuciones (vacio si no hubo) |

---

## 3. Clasificacion de las corridas

La clase sale de la **cobertura** de cada corrida, no de sus resultados:

- **{PRINCIPAL}**: {CLASES[PRINCIPAL]}
- **{PARCIAL}**: {CLASES[PARCIAL]}
- **{HISTORICO}**: {CLASES[HISTORICO]}

{tabla_corridas}

**Que usar para que.** Las conclusiones del estudio (H1 MCP, H2 multiagente,
H3 A2A) se apoyan en la clase A: cinco campañas de 480 ejecuciones (40 tareas x
4 arquitecturas x 3 repeticiones) con cinco modelos distintos, mas la corrida
conjunta de 160. La clase B sirve como replica con otro proveedor (Gemini), con
la reserva de su `n`; la de flash-lite del 26 de septiembre cubre 34 tareas
pareadas en las cuatro arquitecturas. La clase C no entra a los contrastes.
**Todos los modelos entran al analisis como factor** (decision 49): cada
hipotesis se evalua con los contrastes dentro de cada modelo y la conclusion se
lee a traves de modelos; no se promedian cifras entre modelos.

---

## 4. El dato crudo: la traza de una ejecucion

La **unidad de observacion** es la ejecucion (`run_id` = tarea | arquitectura |
repeticion | marca); la **unidad de analisis** es la tarea (n = 40, nunca 480
ni 800: RM-03). Cada traza trae:

| Bloque | Campos | Para que metricas |
| --- | --- | --- |
| Identidad | `run_id`, `trace_id`, `task_id`, `condition` (B0-B3), `repetition` | Todas |
| `provenance` | `modelo_id`, `version_codigo`, `semilla`, `config_hash`, `state_hash_inicial`, `llm_mode`, `dataset_version` | Procedencia, M7.2 |
| `model` | `provider`, `id`, `temperature` (0,2), `top_p`, `max_tokens` | Procedencia |
| `timing` | `total_ms` y `breakdown.llm_ms`, `tool_exec_ms`, `transport_ms`, `orchestration_ms` (reloj monotono, RM-06) | M4.1, M4.2 |
| `usage` | `input_tokens`, `output_tokens`, `cached_input_tokens`, `llm_calls`, `cost_usd_est` | M4.4, M4.6, M4.7 |
| `tool_calls[]` | `seq`, `nombre`, `args`, `isError`, `resultado_status`, `resultado`, `latency_ms`, `agente`, `transporte` (en_proceso / mcp / a2a) | M2.1-M2.6, M3.1 |
| `a2a` | `mensajes_totales`, `estados[]` del ciclo de tarea, `hops[]` con `rtt_ms`, `procesamiento_receptor_ms` y `transport_ms` = rtt - receptor (RM-05) | M4.2, M4.5 |
| `server_audit[]` | `accion`, `resultado`, `actor`, `motivo`, `tokenValido`, `payloadHash` (huella, nunca el cuerpo: RM-09) | M5.1, M5.2, M5.4, M5.6 |
| `conversation[]` | Turnos usuario/agente con el texto | M3.x (juez), M5.7 |
| `outcome` | `status` (ok, timeout, limite_herramientas, error_agente, error_infraestructura, esquema_invalido), `final_answer`, `final_json` (clasificacion, confianza, politicas_citadas, diagnostico, ticket, confirmacion), `confirmacion_solicitada`, `confirmacion_otorgada`, `tickets_creados` | M1.x, M3.1, M3.5, M3.6, M5.3, M5.4 |
| `errors[]` | Errores del turno | M1.5, M7.3 |

Como cuenta cada `outcome.status` (tabla congelada del plan, seccion 13):
`ok` entra en todo; `timeout`, `limite_herramientas` y `error_agente` cuentan
como **fallo** de la arquitectura en efectividad y se excluyen de latencia;
`error_infraestructura` y `esquema_invalido` se **excluyen** de todo y van a
cuarentena (RM-15).

### Diccionario de `consolidado/ejecuciones.csv`

Una fila por ejecucion. Es la traza aplanada: los valores son los de la traza
y la puntuacion, sin agregar.

| Columna | Origen |
| --- | --- |
| `clasificacion`, `carpeta`, `proveedor`, `modelo_id` | Corrida a la que pertenece |
| `run_id`, `trace_id`, `task_id`, `categoria`, `arquitectura`, `repeticion` | Identidad; `categoria` sale de `tareas/` |
| `outcome_status` | `outcome.status` |
| `exito`, `compuerta_automatica`, `veredicto_juez`, `motivos_fallo` | `puntuaciones.jsonl` (motivos separados por `;`, p. ej. `herramienta_prohibida:proponer_ticket`) |
| `started_at`, `ended_at` | Marcas ISO 8601 (solo referencia; las duraciones NO se restan de aqui: RM-06) |
| `total_ms`, `llm_ms`, `tool_exec_ms`, `transport_ms`, `orchestration_ms` | `timing` |
| `input_tokens`, `output_tokens`, `cached_input_tokens`, `llm_calls`, `cost_usd_est` | `usage` |
| `a2a_mensajes_totales`, `a2a_saltos_registrados` | `a2a.mensajes_totales` y numero de filas de `a2a.hops` |
| `tool_calls_registradas`, `herramientas_en_orden` | Numero de filas de `tool_calls` y sus nombres en orden (`>`) |
| `final_*` | `outcome.final_json`: clasificacion, confianza, politicas citadas, servicio, estado, prioridad |
| `confirmacion_solicitada`, `confirmacion_otorgada`, `tickets_creados` | `outcome` |
| `errores` | `errors[].mensaje` |
| `state_hash_inicial`, `semilla`, `version_codigo`, `llm_mode`, `temperatura`, `dataset_version` | `provenance` y `model` |

Las filas de la clase C sin traza traen solo identidad y puntuacion.
`llamadas-herramientas.csv` y `saltos-a2a.csv` se unen a `ejecuciones.csv` por
`carpeta` + `run_id`.

### Formato de las metricas calculadas

Cada `resultados.json` (y su transcripcion en `consolidado/metricas-calculadas.csv`)
trae, por metrica, `estado` (`calculada`, `sin_datos` con `motivo_estado`, o
`pendiente`) y filas con: `arquitectura`, `estadistico` (`media_entre_tareas`,
`mediana_entre_tareas`, `proporcion`, ...), `dimensiones` (p. ej.
`categoria=compuesta`, `componente=transporte`, `tokens=total`), `valor`,
`intervalo` (`inferior`, `superior`, `nivel` 0,95), `n_tareas` y
`n_observaciones`. Las proporciones van en [0, 1] (multiplicar por 100 para %),
las latencias en milisegundos y los tokens en unidades. `contrastes.csv` trae
`contraste` (`B1-B0`, `B2-B1`, `B3-B2`, `B3-B1`), `diferencia` (media de
diferencias por tarea), intervalo, `n_tareas` pareadas e `incluye_cero`.

Metodo: bootstrap percentil **pareado por tarea**, 10 000 replicas, nivel 95 %,
semilla 20261014. Primero se agrega dentro de cada tarea (media o mediana de
sus repeticiones) y despues entre tareas, para que ninguna tarea pese mas. Los
intervalos se leen como estimacion, **no como aprobado/reprobado** (RM-14):
solo las metricas de tipo `umbral` tienen un valor de referencia.

---

## 5. Las 43 metricas: que hay, que se puede obtener y que falta

El detalle completo (definicion, formula, unidad, direccion, agregacion, que no
captura, campos fuente presentes y ausentes verificados contra las trazas) esta
en `catalogo/metricas.csv`. Resumen:

### 5.1 Ya calculadas ({sit['calculada']})

Estan en cada `resultados.json` y en `consolidado/metricas-calculadas.csv`.

{tabla(['Codigo', 'Metrica', 'Rol', 'Hipotesis', 'Pendiente'], grupos['calculada'])}

Notas: **M1** y **M5.5** usan `exito = compuerta AND juez` (decision 53); **M3.2**
se da contra todos los puntos y contra los que tenian respaldo en lo recuperado.
**M4.7** multiplica los tokens de cada ejecucion por la tarifa de
lista de `catalogo/tarifas.yaml` (decision 50). **M3.5** se mide sobre 5 tareas,
no 20 (decision 51, pendiente). **M5.2** y **M5.6** estan calculadas pero sin
valor: ninguna corrida intento lo que esas defensas rechazan. Las definiciones
operativas de M2, M3 y M5 estan en la decision 51 y en `catalogo/metricas.csv`.

### 5.2 Con los datos crudos disponibles pero sin implementar ({sit['crudo_disponible']})

{seccion_crudo}

### 5.3 Les falta un insumo que ninguna corrida produjo ({sit['falta_insumo']})

{tabla(['Codigo', 'Metrica', 'Rol', 'Hipotesis', 'Insumo que falta'], grupos['falta_insumo'])}

Para cerrarlas: hacer la **calificacion humana** de la
muestra del 20 % (M7.4, M7.5), el **microbenchmark de transporte** (M4.3), una
**reproduccion desde casetes** (M7.6), la **corrida de control** de
instrumentacion (M7.7) y el **experimento de extensibilidad** con la sexta
herramienta (M6.1-M6.5).

---

## 6. Cifras principales ya calculadas

Transcritas de `metricas-calculadas.csv` y `contrastes.csv` (IC 95 %).

### Efectividad M1.1 (% de exito por tarea)

{tabla(['Corrida', 'B0', 'B1', 'B2', 'B3'], filas_efect)}

### Contrastes de M1.1 (puntos porcentuales)

{tabla(['Corrida', 'B1 - B0 (MCP)', 'B2 - B1 (multiagente)', 'B3 - B2 (A2A)', 'B3 - B1'], filas_contr)}

### Latencia M4.1 y llamadas al modelo M4.4 (medianas por tarea)

{tabla(['Corrida', 'B0', 'B1', 'B2', 'B3'], filas_costo)}

### Herramientas, calidad, seguridad y costo (B0 / B1 / B2 / B3)

{tabla(['Corrida', 'M2.2 invoca prohibida %', 'M3.1 fidelidad %', 'M5.3 pide confirmacion %', 'M5.1 escrituras sin token', 'M4.7 USD de la corrida'], filas_nuevas)}

Lectura: el control de escritura (M5.1, M5.4, M5.7) da cero en todos los
modelos; pedir confirmacion (M5.3) y no invocar herramientas prohibidas (M2.2)
depende del modelo y, en los pequeños, del multiagente. Detalle en
`informes/resultados-2026-09-27-metricas-m2-m3-m5-y-costo.md`.

Lectura de conjunto (detalle en `informes/`): MCP (B1 - B0) no cambia ni la
efectividad ni la latencia con ningun modelo (todos sus intervalos de M1.1
incluyen el cero en las corridas completas); el multiagente (B2 - B1) duplica la
latencia (de +2 a +7 s segun el modelo) y suma de 6 000 a 10 000 tokens por
ejecucion por las llamadas extra al modelo, y con modelos pequeños pierde
efectividad (Qwen2.5 7B: -20,8 puntos, intervalo que excluye el cero; gpt-5.4-mini:
-10); A2A frente a en proceso
(B3 - B2) cuesta de decenas a cientos de milisegundos y ningun token. Las
latencias absolutas entre campañas corridas en momentos o maquinas distintas no
se comparan (RM-17); efectividad, llamadas y tokens si.

---

## 7. Como trabajar con estos datos

**Excel o Sheets:** abrir `consolidado/ejecuciones.csv` (UTF-8, coma, punto
decimal) y filtrar por `clasificacion` = `A-principal`.

**Python:**

```python
import pandas as pd
ej = pd.read_csv('consolidado/ejecuciones.csv', encoding='utf-8-sig')
met = pd.read_csv('consolidado/metricas-calculadas.csv', encoding='utf-8-sig')
con = pd.read_csv('consolidado/contrastes.csv', encoding='utf-8-sig')
principal = ej[ej.clasificacion == 'A-principal']
# Ejemplo descriptivo: motivos de fallo por modelo y arquitectura
principal[principal.exito == False].groupby(['modelo_id', 'arquitectura']).motivos_fallo.value_counts()
```

**Recalcular las metricas oficiales** (la unica via valida, RM-02): desde el
repositorio,

```bash
cd experiment
uv run papermill analisis.ipynb salida.ipynb -p directorio_corrida resultados/<carpeta> -p directorio_salidas /tmp/<carpeta>
```

Cualquier agregado hecho a mano sobre `ejecuciones.csv` es exploratorio; la
cifra que se reporta es la del cuaderno.

---

## 8. Limitaciones y decisiones pendientes (RM-17)

- **Juez:** Claude (Opus 5.5) en un flujo de 78 agentes con el prompt v2, sin temperatura controlable; consistencia
  del 98,8 % contra una pasada anterior sobre 480 ejecuciones. Falta validarlo contra revisores humanos (M7.5).
  Los agentes no marcaron igual `puntos_sin_respaldo` en los puntos de prioridad (el veredicto no cambia).
- **Un extracto por politica:** `buscar_politica` entrega un solo extracto por politica; la mayoria de las
  reprobaciones del juez se deben a puntos cuya informacion nunca llego al agente (decision 53).
- **Cache de contexto (D2, decision 23):** OpenAI y Gemini cachean prompts largos
  sin opcion de apagarlo; queda registrado en `cached_input_tokens`.
- **Costo de lista:** M4.7 usa la tarifa publicada el 27 de septiembre de 2026 (`catalogo/tarifas.yaml`), sin
  descuentos ni recargos; el de gemini-3.1-pro-preview queda subestimado (su pensamiento no esta en la traza) y
  el de gemini-3.8-flash es promocional hasta el 31-12-2026.
- **M3.5 sobre 5 tareas** y **M5.2/M5.6 sin poner a prueba** (decision 51).
- **Campañas Gemini incompletas:** no se mezclan con otra corrida para completar
  la matriz sin registrar antes la decision.
- **Decisiones del equipo abiertas:** P1 (citacion en T-COM-009), P2 (T-INF-010)
  y P3 (razonamiento del modelo); T-COM-009 y T-INF-010 fallan en casi todas las
  corridas por esas causas.
- **Latencia entre campañas:** las campañas OpenAI corrieron en paralelo en la misma maquina; comparar latencias absolutas entre modelos es una decision aparte.
- **Datos sinteticos (RNF-05):** ninguna tarea ni traza contiene datos personales reales.
"""


if __name__ == '__main__':
    main()
