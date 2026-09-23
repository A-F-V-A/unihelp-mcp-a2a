"""Configuracion de una corrida: lo que hay que congelar antes de ejecutar.

Todo lo que puede cambiar el significado de una cifra vive en `corrida.yaml` y
viaja a `provenance.config_hash` de cada traza, de modo que dos corridas con
configuraciones distintas nunca se confundan.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

import yaml

RAIZ_EJECUTOR = Path(__file__).resolve().parent
RAIZ_EXPERIMENTO = RAIZ_EJECUTOR.parent
RAIZ_REPOSITORIO = RAIZ_EXPERIMENTO.parent
RUTA_CORRIDA = RAIZ_EJECUTOR / 'corrida.yaml'
DIRECTORIO_TAREAS = RAIZ_REPOSITORIO / 'docs' / 'tasks'
RUTA_ESQUEMA_TRAZA = RAIZ_EXPERIMENTO / 'schemas' / 'traza.schema.json'
RUTA_HUELLAS_VARIANTES = RAIZ_EJECUTOR / 'huellas-variantes.json'

MODOS_LLM = ('live', 'record', 'replay')
ARQUITECTURAS = ('B0', 'B1', 'B2', 'B3')


class ErrorConfiguracion(ValueError):
    """La configuracion de la corrida no permite ejecutar sin adivinar un valor."""


@dataclass(frozen=True)
class Tarifa:
    """Tarifa congelada del modelo, en dolares por millon de tokens (M4.7).

    `configurada` es `False` mientras nadie haya fijado la tarifa real: el costo
    sale entonces 0,0 y el manifiesto lo deja escrito, para que nadie interprete
    un costo cero como un costo medido.
    """

    entrada_usd_por_millon: float
    salida_usd_por_millon: float
    configurada: bool

    def costo_usd(self, tokens_entrada: int, tokens_salida: int) -> float:
        entrada = tokens_entrada * self.entrada_usd_por_millon / 1_000_000
        salida = tokens_salida * self.salida_usd_por_millon / 1_000_000
        return round(entrada + salida, 8)


@dataclass(frozen=True)
class Configuracion:
    semilla: int
    repeticiones: int
    arquitecturas: tuple[str, ...]
    """`None` = las 40 tareas del conjunto."""
    tareas: tuple[str, ...] | None
    backends: dict[str, str]
    tarifa: Tarifa
    timeout_http_s: float
    directorio_salida: Path
    modo_llm: str
    dataset_version: str
    verificar_fidelidad_citacion: bool

    def url_de(self, arquitectura: str) -> str:
        url = self.backends.get(arquitectura)
        if url is None:
            raise ErrorConfiguracion(
                f'No hay URL configurada para {arquitectura} en corrida.yaml (backends).'
            )
        return url.rstrip('/')

    def huella_configuracion(self) -> str:
        """Huella de lo que puede mover una cifra. El directorio de salida no cuenta."""
        canonico = json.dumps(
            {
                'semilla': self.semilla,
                'repeticiones': self.repeticiones,
                'arquitecturas': list(self.arquitecturas),
                'tareas': list(self.tareas) if self.tareas else 'todas',
                'tarifa': [
                    self.tarifa.entrada_usd_por_millon,
                    self.tarifa.salida_usd_por_millon,
                ],
                'modo_llm': self.modo_llm,
                'dataset_version': self.dataset_version,
                'verificar_fidelidad_citacion': self.verificar_fidelidad_citacion,
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        return f'sha256:{hashlib.sha256(canonico.encode("utf-8")).hexdigest()}'


def _entero(datos: dict[str, Any], clave: str, minimo: int) -> int:
    valor = datos.get(clave)
    if not isinstance(valor, int) or isinstance(valor, bool) or valor < minimo:
        raise ErrorConfiguracion(f'{clave} debe ser un entero >= {minimo}; llego {valor!r}.')
    return valor


def leer_configuracion(ruta: Path = RUTA_CORRIDA) -> Configuracion:
    """Lee `corrida.yaml`. Un valor ausente o invalido detiene la corrida, no se supone."""
    if not ruta.exists():
        raise ErrorConfiguracion(f'No existe el archivo de corrida {ruta}.')
    datos = yaml.safe_load(ruta.read_text(encoding='utf-8')) or {}
    corrida = datos.get('corrida') or {}
    tarifa_datos = datos.get('tarifa_usd_por_millon') or {}
    salidas = datos.get('salidas') or {}
    compuerta = datos.get('compuerta') or {}

    arquitecturas = tuple(corrida.get('arquitecturas') or ['B0'])
    desconocidas = [a for a in arquitecturas if a not in ARQUITECTURAS]
    if desconocidas:
        raise ErrorConfiguracion(f'Arquitecturas desconocidas: {desconocidas}.')

    modo_llm = str(corrida.get('modo_llm', 'record'))
    if modo_llm not in MODOS_LLM:
        raise ErrorConfiguracion(f'modo_llm debe ser uno de {MODOS_LLM}; llego {modo_llm!r}.')

    tareas = corrida.get('tareas')
    entrada = float(tarifa_datos.get('entrada') or 0.0)
    salida = float(tarifa_datos.get('salida') or 0.0)

    directorio = Path(str(salidas.get('directorio', 'corridas')))
    if not directorio.is_absolute():
        directorio = RAIZ_EXPERIMENTO / directorio

    return Configuracion(
        semilla=_entero(corrida, 'semilla', 0),
        repeticiones=_entero(corrida, 'repeticiones', 1),
        arquitecturas=arquitecturas,
        tareas=tuple(tareas) if tareas else None,
        backends=dict(datos.get('backends') or {}),
        tarifa=Tarifa(entrada, salida, configurada=entrada > 0 or salida > 0),
        timeout_http_s=float((datos.get('limites') or {}).get('timeout_http_s', 180)),
        directorio_salida=directorio,
        modo_llm=modo_llm,
        dataset_version=str(datos.get('dataset_version', '1.0')),
        verificar_fidelidad_citacion=bool(compuerta.get('verificar_fidelidad_citacion', True)),
    )


def con_anulaciones(base: Configuracion, **anulaciones: Any) -> Configuracion:
    """Aplica las opciones de la linea de comandos sobre el archivo."""
    limpias = {clave: valor for clave, valor in anulaciones.items() if valor is not None}
    return replace(base, **limpias) if limpias else base


def version_codigo() -> str:
    """Commit que produce la traza. Sin git, un marcador explicito, nunca un valor falso."""
    try:
        salida = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=RAIZ_REPOSITORIO,
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return 'sin-git'
    sucio = subprocess.run(
        ['git', 'status', '--porcelain'],
        cwd=RAIZ_REPOSITORIO,
        capture_output=True,
        text=True,
        check=False,
    )
    # El sufijo importa: una traza producida con cambios sin confirmar no es reproducible.
    marca = '+sucio' if sucio.stdout.strip() else ''
    return f'{salida.stdout.strip()[:12]}{marca}'
