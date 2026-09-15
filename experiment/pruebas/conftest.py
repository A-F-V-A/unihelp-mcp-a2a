"""Fixtures compartidas: una corrida sintetica generada una vez por sesion."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from analisis.carga import Consolidado, consolidar, escribir_parquet, leer_parquet
from analisis.familias import Contexto, ResultadoMetrica, calcular
from analisis.inferencia import ConfiguracionBootstrap
from analisis.registro import RAIZ_EXPERIMENTO, Registro, cargar_registro
from fixtures.generador import generar

DIRECTORIO_EJEMPLOS = RAIZ_EXPERIMENTO / 'schemas' / 'ejemplos'


@pytest.fixture(scope='session')
def registro() -> Registro:
    return cargar_registro()


@pytest.fixture(scope='session')
def corrida_sintetica(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return generar(tmp_path_factory.mktemp('corrida-sintetica'))


@pytest.fixture(scope='session')
def consolidado(registro: Registro, corrida_sintetica: Path) -> Consolidado:
    return consolidar(corrida_sintetica, registro)


def construir_contexto(
    registro: Registro, consolidado: Consolidado, corrida: Path, intermedios: Path
) -> Contexto:
    """Mismo recorrido que el cuaderno: las metricas se calculan desde el Parquet releido."""
    escribir_parquet(consolidado, intermedios)
    ejecuciones, intentos = leer_parquet(intermedios)
    configuracion = ConfiguracionBootstrap(
        replicas=registro.inferencia['replicas'],
        nivel=registro.inferencia['nivel'],
        semilla=registro.inferencia['semilla'],
    )
    return Contexto(registro, ejecuciones, intentos, consolidado.insumos, configuracion, corrida)


@pytest.fixture(scope='session')
def contexto(
    registro: Registro,
    consolidado: Consolidado,
    corrida_sintetica: Path,
    tmp_path_factory: pytest.TempPathFactory,
) -> Contexto:
    return construir_contexto(registro, consolidado, corrida_sintetica, tmp_path_factory.mktemp('intermedios'))


@pytest.fixture(scope='session')
def resultados(contexto: Contexto) -> dict[str, ResultadoMetrica]:
    return calcular(contexto)


def leer_traza_valida() -> dict[str, Any]:
    return json.loads((DIRECTORIO_EJEMPLOS / 'traza-valida.json').read_text(encoding='utf-8'))


def escribir_jsonl(ruta: Path, documentos: list[Any]) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open('w', encoding='utf-8', newline='\n') as archivo:
        for documento in documentos:
            archivo.write((documento if isinstance(documento, str) else json.dumps(documento)) + '\n')
