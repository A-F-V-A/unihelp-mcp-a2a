"""Linea de comandos del ejecutor (`uv run python -m ejecutor <comando>`).

    validar     comprueba las 40 tareas y la configuracion, sin ejecutar nada
    huellas     regenera huellas-variantes.json desde la semilla
    salud       comprueba que cada backend configurado responde
    correr      ejecuta la matriz y escribe trazas y puntuaciones
    puntuar     recalcula las puntuaciones de una corrida, sin volver a ejecutar
    verificar   revisa una corrida ya escrita (esquema, completitud, huellas)
    puntuar-observacion   veredicto de UNA observacion del visor (JSON por stdin)
    importar-visor        convierte un observaciones.jsonl del visor en una corrida
    indice      reescribe corridas/indice.json, el catalogo que lee el panel web
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from . import traza as armado
from .cliente import ClienteBackend, ErrorBackend
from .configuracion import (
    RAIZ_REPOSITORIO,
    RUTA_HUELLAS_VARIANTES,
    ErrorConfiguracion,
    con_anulaciones,
    leer_configuracion,
    version_codigo,
)
from .corrida import ARCHIVO_HUELLAS, ARCHIVO_TRAZAS, actualizar_indice, correr, repuntuar
from .observaciones import (
    ErrorObservacion,
    importar,
    puntuar_observacion,
    validar_observacion,
)
from .tareas import cargar_tareas, huellas_esperadas, huellas_por_variante


def _comando_validar(args: argparse.Namespace) -> int:
    configuracion = _configuracion(args)
    tareas = cargar_tareas()
    variantes = huellas_por_variante()
    huellas_esperadas(tareas, variantes)  # falla si falta una variante

    por_categoria: dict[str, int] = {}
    for tarea in tareas:
        por_categoria[tarea.categoria] = por_categoria.get(tarea.categoria, 0) + 1
    adversarial = [t.id for t in tareas if t.corpus == 'adversarial']

    print(f'{len(tareas)} tareas validas: ' + ', '.join(f'{k}={v}' for k, v in sorted(por_categoria.items())))
    print(f'corpus adversarial en: {", ".join(adversarial)}')
    print(f'variantes de estado con huella: {len(variantes)}')
    print(f'arquitecturas: {", ".join(configuracion.arquitecturas)}; repeticiones: {configuracion.repeticiones}')
    print(f'config_hash: {configuracion.huella_configuracion()}')
    if not configuracion.tarifa.configurada:
        print('AVISO: la tarifa del modelo esta en cero; cost_usd_est saldra 0,0 (M4.7).')
    for arquitectura in configuracion.arquitecturas:
        print(f'  {arquitectura} -> {configuracion.url_de(arquitectura)}')
    return 0


def _comando_huellas(_: argparse.Namespace) -> int:
    """Pide las huellas a la semilla, que es su unica fuente, y las cachea."""
    proceso = subprocess.run(
        ['pnpm', '-s', 'conocimiento:huellas'],
        cwd=RAIZ_REPOSITORIO,
        capture_output=True,
        text=True,
        shell=sys.platform == 'win32',
    )
    if proceso.returncode != 0:
        print(proceso.stderr[-1500:], file=sys.stderr)
        return 1
    # nx antepone su propio encabezado, con colores ANSI que tambien traen `[`.
    limpia = re.sub('\x1b\\[[0-9;]*m', '', proceso.stdout)
    inicio = limpia.find('\n[')
    if inicio < 0:
        print('La salida de conocimiento:huellas no trae JSON.', file=sys.stderr)
        return 1
    # `raw_decode`: nx puede escribir mas texto despues del JSON.
    variantes, _ = json.JSONDecoder().raw_decode(limpia[inicio + 1 :])
    RUTA_HUELLAS_VARIANTES.write_text(
        json.dumps({'variantes': variantes}, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    print(f'{len(variantes)} variantes escritas en {RUTA_HUELLAS_VARIANTES.name}')
    return 0


def _comando_salud(args: argparse.Namespace) -> int:
    configuracion = _configuracion(args)
    codigo = 0
    for arquitectura in configuracion.arquitecturas:
        url = configuracion.url_de(arquitectura)
        try:
            with ClienteBackend(url, configuracion.timeout_http_s) as cliente:
                salud = cliente.salud()
                # `arquitectura` de `RespuestaSalud`: sirve para no correr B1
                # contra un proceso de B0 levantado por error (decision 7).
                informada = salud.get('arquitectura', '?')
                print(
                    f'{arquitectura} {url}: {salud.get("estado", "?")} '
                    f'({salud.get("servicio", "?")}, informa {informada})'
                )
                if informada != arquitectura:
                    print(f'  AVISO: responde {informada}, no {arquitectura}.')
                    codigo = 1
        except ErrorBackend as error:
            print(f'{arquitectura} {url}: SIN RESPUESTA ({error})')
            codigo = 1
    return codigo


def _comando_correr(args: argparse.Namespace) -> int:
    configuracion = _configuracion(args)
    for arquitectura in configuracion.arquitecturas:
        url = configuracion.url_de(arquitectura)
        try:
            with ClienteBackend(url, configuracion.timeout_http_s) as cliente:
                cliente.salud()
        except ErrorBackend as error:
            print(f'{arquitectura} no responde en {url}: {error}', file=sys.stderr)
            return 1

    corrida = correr(configuracion, nombre=args.nombre)
    validas = sum(1 for r in corrida.resultados if r.valida)
    aprobadas = sum(1 for r in corrida.resultados if r.aprobada_compuerta)
    print(
        f'\n{len(corrida.resultados)} ejecuciones; {validas} trazas validas; '
        f'{aprobadas} superaron la compuerta automatica.'
    )
    print(f'Artefactos en {corrida.directorio}')
    return 0


def _comando_puntuar(args: argparse.Namespace) -> int:
    conteo = repuntuar(Path(args.directorio), _configuracion(args))
    return 0 if conteo['ejecuciones'] > 0 else 1


def _comando_verificar(args: argparse.Namespace) -> int:
    directorio = Path(args.directorio)
    ruta = directorio / ARCHIVO_TRAZAS
    if not ruta.exists():
        print(f'No hay {ARCHIVO_TRAZAS} en {directorio}.', file=sys.stderr)
        return 1
    huellas = json.loads((directorio / ARCHIVO_HUELLAS).read_text(encoding='utf-8'))['huellas']

    total = invalidas = huella_mala = 0
    for numero, linea in enumerate(ruta.read_text(encoding='utf-8').splitlines(), start=1):
        if not linea.strip():
            continue
        total += 1
        traza = json.loads(linea)
        errores = armado.errores_de_esquema(traza)
        if errores:
            invalidas += 1
            print(f'linea {numero} ({traza.get("run_id")}): {errores[0]}')
        esperada = huellas.get(traza.get('task_id'))
        if esperada and traza['provenance']['state_hash_inicial'] != esperada:
            huella_mala += 1
            print(f'linea {numero} ({traza.get("run_id")}): huella de estado inesperada')

    print(f'{total} trazas; {invalidas} invalidas; {huella_mala} con huella inesperada.')
    return 0 if invalidas == 0 and huella_mala == 0 else 1


def _comando_indice(args: argparse.Namespace) -> int:
    """Cataloga las corridas para el panel web; util tras copiar o borrar una a mano."""
    indice = actualizar_indice(_configuracion(args).directorio_salida)
    print(f'{len(indice["corridas"])} corridas en el indice.')
    return 0


def _comando_puntuar_observacion(_: argparse.Namespace) -> int:
    """Lee una observacion del visor por stdin y escribe su veredicto en JSON.

    No escribe archivos: es lo que el visor muestra en el panel al terminar cada
    tarea. Un problema de entrada sale como JSON con `error`, para que el visor
    lo muestre en vez de quedarse sin veredicto.
    """
    try:
        observacion = validar_observacion(json.loads(sys.stdin.read()))
        configuracion = con_anulaciones(
            leer_configuracion(), arquitecturas=(str(observacion['condicion']),)
        )
        veredicto = puntuar_observacion(
            observacion,
            configuracion,
            {t.id: t for t in cargar_tareas()},
            version_codigo(),
        )
    except (json.JSONDecodeError, ErrorObservacion, ErrorConfiguracion) as error:
        print(json.dumps({'error': f'{type(error).__name__}: {error}'}, ensure_ascii=False))
        return 1
    print(json.dumps(veredicto, ensure_ascii=False))
    return 0


def _comando_importar_visor(args: argparse.Namespace) -> int:
    corrida = importar(Path(args.observaciones), leer_configuracion(), nombre=args.nombre)
    validas = sum(1 for r in corrida.resultados if r.valida)
    aprobadas = sum(1 for r in corrida.resultados if r.aprobada_compuerta)
    print(
        f'{len(corrida.resultados)} observaciones; {validas} trazas validas; '
        f'{aprobadas} superaron la compuerta automatica.'
    )
    print(f'Corrida en {corrida.directorio}')
    return 0


def _configuracion(args: argparse.Namespace):
    base = leer_configuracion()
    tareas = None
    if getattr(args, 'tareas', None):
        # Admite `T-COM-001,T-ADV-*` y expande el comodin sobre el conjunto real.
        patrones = [p.strip() for p in args.tareas.split(',') if p.strip()]
        conocidas = [t.id for t in cargar_tareas()]
        seleccion = [
            tarea
            for tarea in conocidas
            if any(re.fullmatch(p.replace('*', '.*'), tarea) for p in patrones)
        ]
        if not seleccion:
            raise ErrorConfiguracion(f'Ninguna tarea coincide con {patrones}.')
        tareas = tuple(seleccion)
    return con_anulaciones(
        base,
        tareas=tareas,
        repeticiones=getattr(args, 'repeticiones', None),
        arquitecturas=tuple(args.arquitecturas.split(',')) if getattr(args, 'arquitecturas', None) else None,
        modo_llm=getattr(args, 'modo_llm', None),
    )


def _analizador() -> argparse.ArgumentParser:
    analizador = argparse.ArgumentParser(prog='ejecutor', description=__doc__)
    sub = analizador.add_subparsers(dest='comando', required=True)

    def comunes(p: argparse.ArgumentParser) -> None:
        p.add_argument('--tareas', help='ids separados por coma; admite comodin (T-ADV-*)')
        p.add_argument('--repeticiones', type=int)
        p.add_argument('--arquitecturas', help='por ejemplo B0 o B0,B1')
        p.add_argument('--modo-llm', dest='modo_llm', choices=('live', 'record', 'replay'))

    validar = sub.add_parser('validar', help='revisa tareas y configuracion sin ejecutar')
    comunes(validar)
    validar.set_defaults(funcion=_comando_validar)

    huellas = sub.add_parser('huellas', help='regenera huellas-variantes.json desde la semilla')
    huellas.set_defaults(funcion=_comando_huellas)

    salud = sub.add_parser('salud', help='comprueba que los backends responden')
    comunes(salud)
    salud.set_defaults(funcion=_comando_salud)

    correr_cmd = sub.add_parser('correr', help='ejecuta la matriz')
    comunes(correr_cmd)
    correr_cmd.add_argument('--nombre', help='nombre del directorio de la corrida')
    correr_cmd.set_defaults(funcion=_comando_correr)

    puntuar = sub.add_parser(
        'puntuar', help='recalcula puntuaciones.jsonl desde las trazas, sin ejecutar'
    )
    puntuar.add_argument('directorio')
    puntuar.set_defaults(funcion=_comando_puntuar)

    verificar = sub.add_parser('verificar', help='revisa una corrida ya escrita')
    verificar.add_argument('directorio')
    verificar.set_defaults(funcion=_comando_verificar)

    puntuar_obs = sub.add_parser(
        'puntuar-observacion', help='veredicto de una observacion del visor (JSON por stdin)'
    )
    puntuar_obs.set_defaults(funcion=_comando_puntuar_observacion)

    importar_cmd = sub.add_parser(
        'importar-visor', help='convierte un observaciones.jsonl del visor en una corrida'
    )
    importar_cmd.add_argument('observaciones', help='ruta a observaciones.jsonl')
    importar_cmd.add_argument('--nombre', help='nombre del directorio de la corrida')
    importar_cmd.set_defaults(funcion=_comando_importar_visor)

    indice = sub.add_parser('indice', help='reescribe el catalogo de corridas que lee el panel')
    indice.set_defaults(funcion=_comando_indice)
    return analizador


def principal(argumentos: list[str] | None = None) -> int:
    args = _analizador().parse_args(argumentos)
    try:
        return int(args.funcion(args))
    except (ErrorConfiguracion, ErrorBackend, ValueError) as error:
        print(f'{type(error).__name__}: {error}', file=sys.stderr)
        return 1
