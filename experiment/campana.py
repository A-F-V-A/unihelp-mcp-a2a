"""Campaña de corridas: varios modelos, las cuatro arquitecturas, en paralelo.

Cada modelo corre en su PROPIO entorno aislado (base de datos, `mcp-server` y
los siete backends en puertos propios), de modo que las campañas de distintos
modelos avanzan al mismo tiempo sin compartir estado: el restablecimiento del
entorno de una no toca a las otras (HU-36) y, dentro de cada campaña, la
matriz sigue corriendo en serie (RM-04, D1). Lo que las campañas comparten es
la maquina: la latencia del modelo domina y se mide en el proveedor, pero la
carga local es un factor comun a las cuatro arquitecturas de una misma
campaña, asi que los contrastes dentro de cada modelo siguen siendo pareados.
Comparar latencias ENTRE campañas corridas a la vez es una decision de
medicion aparte (RM-17).

Uso (desde `experiment/`, con los backends ya compilados con `nx build`):

    uv run python campana.py --modelos gpt-5.5-2026-04-23,gpt-5.4-2026-03-05 --repeticiones 3
    uv run python campana.py --proveedor ollama --modelos unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k

Con `--proveedor ollama` (decision 46) los backends hablan con el servidor local
de Ollama (`--url-base`, por defecto la suya) y no hace falta clave. Una sola GPU
sirve un modelo a la vez: con Ollama conviene UNA campaña por corrida, porque
dos modelos locales a la vez se turnarian la GPU y sus latencias se mezclarian.

Por cada modelo deja `corridas/campana-<modelo>-r<R>`, el cuaderno ejecutado y
sus salidas en `salidas/campana-<modelo>-r<R>` y una copia de los artefactos en
`resultados/<fecha>-campana-<modelo>-r<R>`. Requiere PostgreSQL con las bases
`unihelp_c1..cN` ya migradas y sembradas (una por campaña).
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent  # raiz del monorepo
EXPERIMENTO = RAIZ / 'experiment'
APPS = {
    # app: desplazamiento de puerto dentro de la campaña
    'mcp-server': 10,
    'b0-directo': 0,
    'b1-mcp-agente': 1,
    'b2-multiagente-local': 2,
    'b3-a2a-orquestador': 3,
    'b3-a2a-conocimiento': 4,
    'b3-a2a-diagnostico': 5,
}
USUARIO_BD = os.environ.get('POSTGRES_USER', 'unihelp')
CLAVE_BD = os.environ.get('POSTGRES_PASSWORD', 'unihelp')


def leer_env(ruta: Path) -> dict[str, str]:
    valores: dict[str, str] = {}
    for linea in ruta.read_text(encoding='utf-8').splitlines():
        linea = linea.strip()
        if linea and not linea.startswith('#') and '=' in linea:
            clave, valor = linea.split('=', 1)
            valores[clave.strip()] = valor.strip()
    return valores


def slug(modelo: str) -> str:
    return modelo.replace('.', '-').replace(':', '-')


def salud(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


class Campana:
    def __init__(
        self,
        indice: int,
        modelo: str,
        repeticiones: int,
        credenciales: dict[str, str],
        proveedor: str = 'openai',
        url_base: str | None = None,
    ):
        self.indice, self.modelo, self.repeticiones = indice, modelo, repeticiones
        self.proveedor, self.url_base = proveedor, url_base
        self.base_puerto = 3000 + 100 * indice
        self.bd = f'unihelp_c{indice}'
        self.nombre = f'campana-{slug(modelo)}-r{repeticiones}'
        self.logs = EXPERIMENTO / 'corridas' / 'campana-logs' / self.nombre
        self.logs.mkdir(parents=True, exist_ok=True)
        self.procesos: list[subprocess.Popen] = []
        self.credenciales = credenciales
        self.resultado: str | None = None

    def puerto(self, app: str) -> int:
        return self.base_puerto + APPS[app]

    def entorno(self, app: str) -> dict[str, str]:
        url_bd = f'postgres://{USUARIO_BD}:{CLAVE_BD}@localhost:5432/{self.bd}'
        base = {
            **os.environ,
            # Ollama no autentica: la clave solo se exige con OpenAI (decision 46).
            'OPENAI_API_KEY': self.credenciales.get('OPENAI_API_KEY', ''),
            'UNIHELP_MODELO_PROVEEDOR': self.proveedor,
            **({'UNIHELP_MODELO_URL_BASE': self.url_base} if self.url_base else {}),
            'UNIHELP_MODELO_ID': self.modelo,
            'UNIHELP_MODELOS_PERMITIDOS': self.modelo,
            'UNIHELP_MODELO_ESFUERZO': 'none',
            'UNIHELP_MODO_LLM': 'record',
            'UNIHELP_DIRECTORIO_CASETES': f'experiment/casetes/{slug(self.modelo)}',
            'UNIHELP_PERFIL': 'experimento',
            'CONOCIMIENTO_DATABASE_URL': url_bd,
            'TICKETS_DATABASE_URL': url_bd,
            'PORT': str(self.puerto(app)),
            'MCP_SERVER_URL': f'http://localhost:{self.puerto("mcp-server")}',
            'A2A_SELF_URL': f'http://localhost:{self.puerto(app)}',
            'A2A_CONOCIMIENTO_URL': f'http://localhost:{self.puerto("b3-a2a-conocimiento")}',
            'A2A_DIAGNOSTICO_URL': f'http://localhost:{self.puerto("b3-a2a-diagnostico")}',
            'A2A_REGISTRY_PATH': str(RAIZ / 'apps/b3-a2a-orquestador/config/a2a-registry.yaml'),
        }
        return base

    def arrancar(self) -> None:
        for app in APPS:
            log = open(self.logs / f'{app}.log', 'w', encoding='utf-8')
            self.procesos.append(
                subprocess.Popen(
                    ['node', f'dist/apps/{app}/main.js'],
                    cwd=RAIZ, env=self.entorno(app), stdout=log, stderr=subprocess.STDOUT,
                )
            )
        limite = time.monotonic() + 90
        while time.monotonic() < limite:
            if all(salud(f'http://localhost:{self.puerto(a)}/health') for a in APPS):
                return
            time.sleep(2)
        raise RuntimeError(f'[{self.modelo}] los backends no respondieron a tiempo')

    def detener(self) -> None:
        for p in self.procesos:
            p.terminate()
        for p in self.procesos:
            try:
                p.wait(timeout=15)
            except subprocess.TimeoutExpired:
                p.kill()

    def archivo_corrida(self) -> Path:
        datos = yaml.safe_load((EXPERIMENTO / 'ejecutor' / 'corrida.yaml').read_text(encoding='utf-8'))
        datos['corrida']['arquitecturas'] = ['B0', 'B1', 'B2', 'B3']
        datos['corrida']['repeticiones'] = self.repeticiones
        datos['backends'] = {
            'B0': f'http://localhost:{self.puerto("b0-directo")}',
            'B1': f'http://localhost:{self.puerto("b1-mcp-agente")}',
            'B2': f'http://localhost:{self.puerto("b2-multiagente-local")}',
            'B3': f'http://localhost:{self.puerto("b3-a2a-orquestador")}',
        }
        ruta = self.logs / 'corrida.yaml'
        ruta.write_text(yaml.safe_dump(datos, allow_unicode=True, sort_keys=False), encoding='utf-8')
        return ruta

    def correr(self) -> None:
        inicio = time.monotonic()
        try:
            self.arrancar()
            corrida = self.archivo_corrida()
            with open(self.logs / 'ejecutor.log', 'w', encoding='utf-8') as log:
                r = subprocess.run(
                    [
                        'uv', 'run', 'python', '-u', '-m', 'ejecutor', 'correr',
                        '--corrida', str(corrida), '--nombre', self.nombre,
                    ],
                    cwd=EXPERIMENTO, stdout=log, stderr=subprocess.STDOUT,
                )
            if r.returncode != 0:
                raise RuntimeError(f'[{self.modelo}] el ejecutor termino con codigo {r.returncode}')
        finally:
            self.detener()
        with open(self.logs / 'cuaderno.log', 'w', encoding='utf-8') as log:
            r = subprocess.run(
                [
                    'uv', 'run', 'papermill', 'analisis.ipynb', f'salidas/analisis.{self.nombre}.ipynb',
                    '--cwd', '.', '-p', 'directorio_corrida', f'corridas/{self.nombre}',
                    '-p', 'directorio_salidas', f'salidas/{self.nombre}',
                ],
                cwd=EXPERIMENTO, stdout=log, stderr=subprocess.STDOUT,
            )
        if r.returncode != 0:
            raise RuntimeError(f'[{self.modelo}] el cuaderno termino con codigo {r.returncode}')
        destino = EXPERIMENTO / 'resultados' / f'{dt.date.today().isoformat()}-{self.nombre}'
        destino.mkdir(parents=True, exist_ok=True)
        for origen in [EXPERIMENTO / 'corridas' / self.nombre, EXPERIMENTO / 'salidas' / self.nombre]:
            for archivo in origen.iterdir():
                if archivo.is_file():
                    shutil.copy2(archivo, destino / archivo.name)
        minutos = (time.monotonic() - inicio) / 60
        self.resultado = f'{self.nombre}: listo en {minutos:.0f} min -> {destino}'


def main() -> int:
    analizador = argparse.ArgumentParser(description=__doc__)
    analizador.add_argument('--modelos', required=True, help='identificadores separados por coma')
    analizador.add_argument('--repeticiones', type=int, default=3)
    analizador.add_argument('--proveedor', choices=('openai', 'ollama'), default='openai')
    analizador.add_argument('--url-base', dest='url_base', help='URL base del proveedor (Ollama)')
    args = analizador.parse_args()
    modelos = [m.strip() for m in args.modelos.split(',') if m.strip()]
    ruta_env = RAIZ / 'apps/b0-directo/.env'
    credenciales = leer_env(ruta_env) if ruta_env.exists() else {}
    if args.proveedor == 'openai' and not credenciales.get('OPENAI_API_KEY'):
        print(f'Falta OPENAI_API_KEY en {ruta_env}', file=sys.stderr)
        return 1
    campanas = [
        Campana(i + 1, m, args.repeticiones, credenciales, args.proveedor, args.url_base)
        for i, m in enumerate(modelos)
    ]
    errores: dict[str, str] = {}

    def envolver(c: Campana) -> None:
        try:
            c.correr()
        except Exception as fallo:  # noqa: BLE001 - se reporta al final
            errores[c.modelo] = str(fallo)

    hilos = [threading.Thread(target=envolver, args=(c,), name=c.nombre) for c in campanas]
    for h in hilos:
        h.start()
        time.sleep(5)  # arranques escalonados
    print(f'{len(hilos)} campañas en marcha; logs en corridas/campana-logs/', flush=True)
    for h in hilos:
        h.join()
    for c in campanas:
        print(c.resultado or f'{c.nombre}: FALLO {errores.get(c.modelo)}')
    return 1 if errores else 0


if __name__ == '__main__':
    sys.exit(main())
