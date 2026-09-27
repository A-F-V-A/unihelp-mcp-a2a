"""Verificacion practica de M6.3: que servicios hay que reiniciar para que la sexta herramienta exista.

    cd experiment && uv run python m6/verificar_m63.py <B0|B1|B2|B3>

No se decide por inspeccion (ficha M6.3). Para la arquitectura dada:

1. Levanta sus servicios con los binarios de la base (worktree ../unihelp-m6-base) en
   puertos 39xx y confirma con una conversacion que el agente NO usa la herramienta.
2. Compara el `dist/` de cada servicio entre la base y la rama: un servicio con el
   mismo binario no puede necesitar reinicio.
3. Prueba los subconjuntos de servicios cambiados de menor a mayor tamaño. Cada prueba
   parte de todo en la base, reinicia ese subconjunto con los binarios de la rama y abre
   una conversacion NUEVA con la pregunta del caso 9. El primer subconjunto con el que
   el agente llama a la herramienta es el minimo: M6.3 es su tamaño. En B1 el primer
   subconjunto es solo `mcp-server`, como pide la decision 58.

El modelo (Ollama, qwen2.5 7B) no es determinista: cada prueba se intenta hasta dos
veces antes de declararla negativa. Deja la evidencia en m6/evidencias/m63-<arq>/.
Exige que la base y la rama ya esten compiladas (nx build de sus apps).
"""

from __future__ import annotations

import hashlib
import itertools
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PADRE = AQUI.parents[2]
HERRAMIENTA = 'consultar_disponibilidad_soporte'
PREGUNTA = '¿Hay soporte presencial en la sede norte el lunes 12 de octubre de 2026?'
MODELO = 'unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k'
BASE_PUERTO = 3900
DESPLAZAMIENTO = {
    'mcp-server': 10,
    'b0-directo': 0,
    'b1-mcp-agente': 1,
    'b2-multiagente-local': 2,
    'b3-a2a-orquestador': 3,
    'b3-a2a-conocimiento': 4,
    'b3-a2a-diagnostico': 5,
}
# Orden de arranque: primero lo que los demas consultan al arrancar.
SERVICIOS = {
    'B0': ['b0-directo'],
    'B1': ['mcp-server', 'b1-mcp-agente'],
    'B2': ['mcp-server', 'b2-multiagente-local'],
    'B3': ['mcp-server', 'b3-a2a-conocimiento', 'b3-a2a-diagnostico', 'b3-a2a-orquestador'],
}
ENTRADA = {'B0': 'b0-directo', 'B1': 'b1-mcp-agente', 'B2': 'b2-multiagente-local', 'B3': 'b3-a2a-orquestador'}
INTENTOS = 2


def puerto(app: str) -> int:
    return BASE_PUERTO + DESPLAZAMIENTO[app]


def leer_env(ruta: Path) -> dict[str, str]:
    valores: dict[str, str] = {}
    if not ruta.exists():
        return valores
    for linea in ruta.read_text(encoding='utf-8').splitlines():
        linea = linea.strip()
        if linea and not linea.startswith('#') and '=' in linea:
            clave, valor = linea.split('=', 1)
            valores[clave.strip()] = valor.strip()
    return valores


def huella_dist(worktree: Path, app: str) -> str:
    h = hashlib.sha256()
    raiz = worktree / 'dist' / 'apps' / app
    for archivo in sorted(p for p in raiz.rglob('*') if p.is_file() and p.suffix != '.map'):
        h.update(archivo.relative_to(raiz).as_posix().encode())
        h.update(archivo.read_bytes())
    return h.hexdigest()


def pedir(url: str, cuerpo: dict | None = None, cabeceras: dict | None = None, espera: float = 600) -> dict:
    datos = None if cuerpo is None else json.dumps(cuerpo).encode('utf-8')
    solicitud = urllib.request.Request(url, data=datos, method='POST' if datos else 'GET')
    solicitud.add_header('content-type', 'application/json')
    for clave, valor in (cabeceras or {}).items():
        solicitud.add_header(clave, valor)
    with urllib.request.urlopen(solicitud, timeout=espera) as r:
        return json.loads(r.read().decode('utf-8'))


def sano(app: str) -> bool:
    try:
        with urllib.request.urlopen(f'http://localhost:{puerto(app)}/health', timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


class Banco:
    def __init__(self, arq: str) -> None:
        self.arq = arq
        self.base = PADRE / 'unihelp-m6-base'
        self.rama = PADRE / f'unihelp-m6-{arq.lower()}'
        self.evidencias = AQUI / 'evidencias' / f'm63-{arq.lower()}'
        self.evidencias.mkdir(parents=True, exist_ok=True)
        self.logs = Path(os.environ.get('M6_LOGS', str(self.evidencias / 'logs')))
        self.logs.mkdir(parents=True, exist_ok=True)
        self.procesos: dict[str, subprocess.Popen] = {}
        self.origen: dict[str, str] = {}
        self.arranques = 0

    def entorno(self, app: str, worktree: Path) -> dict[str, str]:
        bd = f'postgres://unihelp:unihelp@localhost:5432/unihelp_m6_{self.arq.lower()}'
        return {
            **os.environ,
            **leer_env(worktree / 'apps' / app / '.env'),
            'OPENAI_API_KEY': '',
            'GEMINI_API_KEY': '',
            'UNIHELP_MODELO_PROVEEDOR': 'ollama',
            'UNIHELP_MODELO_ID': MODELO,
            'UNIHELP_MODELOS_PERMITIDOS': MODELO,
            'UNIHELP_MODELO_ESFUERZO': 'none',
            'UNIHELP_MODO_LLM': 'live',
            'UNIHELP_PERFIL': 'experimento',
            'CONOCIMIENTO_DATABASE_URL': bd,
            'TICKETS_DATABASE_URL': bd,
            'PORT': str(puerto(app)),
            'MCP_SERVER_URL': f'http://localhost:{puerto("mcp-server")}',
            'A2A_SELF_URL': f'http://localhost:{puerto(app)}',
            'A2A_CONOCIMIENTO_URL': f'http://localhost:{puerto("b3-a2a-conocimiento")}',
            'A2A_DIAGNOSTICO_URL': f'http://localhost:{puerto("b3-a2a-diagnostico")}',
            'A2A_REGISTRY_PATH': str(worktree / 'apps/b3-a2a-orquestador/config/a2a-registry.yaml'),
        }

    def arrancar(self, app: str, origen: str) -> None:
        worktree = self.base if origen == 'base' else self.rama
        self.arranques += 1
        log = open(self.logs / f'{self.arranques:02d}-{app}-{origen}.log', 'w', encoding='utf-8')
        self.procesos[app] = subprocess.Popen(
            ['node', f'dist/apps/{app}/main.js'],
            cwd=worktree, env=self.entorno(app, worktree), stdout=log, stderr=subprocess.STDOUT,
        )
        self.origen[app] = origen
        limite = time.monotonic() + 120
        while time.monotonic() < limite:
            if sano(app):
                return
            if self.procesos[app].poll() is not None:
                raise RuntimeError(f'{app} ({origen}) termino al arrancar; ver {log.name}')
            time.sleep(1)
        raise RuntimeError(f'{app} ({origen}) no respondio /health a tiempo')

    def detener(self, app: str) -> None:
        proceso = self.procesos.pop(app, None)
        if proceso is None:
            return
        proceso.terminate()
        try:
            proceso.wait(timeout=20)
        except subprocess.TimeoutExpired:
            proceso.kill()
        # Espera a que el puerto quede libre.
        limite = time.monotonic() + 20
        while sano(app) and time.monotonic() < limite:
            time.sleep(0.5)

    def reiniciar(self, app: str, origen: str) -> None:
        self.detener(app)
        self.arrancar(app, origen)

    def detener_todo(self) -> None:
        for app in list(self.procesos):
            self.detener(app)

    def conversar(self, etiqueta: str) -> dict:
        """Una conversacion nueva con la pregunta del caso 9; guarda respuesta y traza."""
        entrada = f'http://localhost:{puerto(ENTRADA[self.arq])}'
        trace_id = f'm63-{self.arq.lower()}-{etiqueta}-{time.time_ns()}'
        inicio = time.monotonic()
        respuesta = pedir(
            f'{entrada}/api/conversaciones/mensajes',
            {'conversacionId': None, 'texto': PREGUNTA},
            {'x-trace-id': trace_id},
        )
        traza = pedir(f'{entrada}/experimento/trazas/{trace_id}')
        texto = '\n\n'.join(b.get('texto', '') for b in respuesta['respuesta']['bloques'] if b.get('tipo') == 'texto')
        llamadas = [
            {k: c.get(k) for k in ('nombre', 'args', 'isError', 'transporte', 'agente', 'resultado')}
            for c in traza.get('tool_calls', [])
        ]
        uso = any(c['nombre'] == HERRAMIENTA and not c.get('isError') for c in llamadas)
        registro = {
            'etiqueta': etiqueta,
            'trace_id': trace_id,
            'origen_servicios': dict(self.origen),
            'uso_la_herramienta': uso,
            'texto': texto,
            'tool_calls': llamadas,
            'segundos': round(time.monotonic() - inicio, 1),
        }
        (self.evidencias / f'{etiqueta}.json').write_text(
            json.dumps(registro, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
        print(f'  [{etiqueta}] uso={uso} llamadas={[c["nombre"] for c in llamadas]} ({registro["segundos"]} s)')
        return registro

    def prueba(self, etiqueta: str) -> bool:
        for i in range(1, INTENTOS + 1):
            try:
                if self.conversar(f'{etiqueta}-i{i}')['uso_la_herramienta']:
                    return True
            except Exception as error:  # un backend que responde error tambien es evidencia
                detalle = getattr(error, 'read', lambda: b'')().decode('utf-8', 'replace')[:2000]
                (self.evidencias / f'{etiqueta}-i{i}.json').write_text(
                    json.dumps(
                        {'etiqueta': f'{etiqueta}-i{i}', 'origen_servicios': dict(self.origen),
                         'uso_la_herramienta': False, 'error': repr(error), 'detalle': detalle},
                        ensure_ascii=False, indent=2,
                    ) + '\n',
                    encoding='utf-8',
                )
                print(f'  [{etiqueta}-i{i}] error: {error!r}')
        return False


def main() -> int:
    arq = sys.argv[1]
    banco = Banco(arq)
    servicios = SERVICIOS[arq]
    resumen: dict = {'arquitectura': arq, 'servicios_de_la_arquitectura': servicios, 'pruebas': []}
    try:
        huellas = {app: (huella_dist(banco.base, app), huella_dist(banco.rama, app)) for app in servicios}
        cambiados = [app for app in servicios if huellas[app][0] != huellas[app][1]]
        resumen['binario_cambiado'] = {app: huellas[app][0] != huellas[app][1] for app in servicios}
        print(f'{arq}: servicios con binario cambiado: {cambiados}')

        for app in servicios:
            banco.arrancar(app, 'base')
        # Una sola conversacion en la base: si el agente no tiene la herramienta no puede llamarla.
        base = banco.conversar('base')
        resumen['base_uso_la_herramienta'] = base['uso_la_herramienta']
        if base['uso_la_herramienta']:
            raise RuntimeError('La base ya usa la herramienta: el banco esta mal armado.')

        minimo = None
        for tamano in range(1, len(cambiados) + 1):
            for subconjunto in itertools.combinations(cambiados, tamano):
                etiqueta = 'rama-' + '+'.join(subconjunto)
                for app in servicios:  # respeta el orden de arranque
                    if app in subconjunto:
                        banco.reiniciar(app, 'rama')
                usada = banco.prueba(etiqueta)
                resumen['pruebas'].append({'reiniciados': list(subconjunto), 'uso_la_herramienta': usada})
                if usada:
                    minimo = list(subconjunto)
                    break
                for app in servicios:  # vuelve todo a la base antes del siguiente subconjunto
                    if banco.origen.get(app) != 'base':
                        banco.reiniciar(app, 'base')
            if minimo is not None:
                break
        resumen['servicios_reiniciados'] = minimo
        resumen['solo_mcp_server_basto'] = (
            None if 'mcp-server' not in servicios else minimo == ['mcp-server']
        )
    finally:
        banco.detener_todo()
    (banco.evidencias / 'resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: resumen[k] for k in ('servicios_reiniciados', 'binario_cambiado')}, ensure_ascii=False))
    return 0 if resumen.get('servicios_reiniciados') is not None else 1


if __name__ == '__main__':
    raise SystemExit(main())
