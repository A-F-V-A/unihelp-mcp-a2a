"""jsonschema juzga los casos compartidos igual que AJV en libs/trazas (HU-MET-01)."""

from __future__ import annotations

import copy
import json

import pytest

from analisis.carga import errores_esquema, validador_de
from analisis.registro import leer_esquema
from conftest import DIRECTORIO_EJEMPLOS, leer_traza_valida

CASOS = json.loads((DIRECTORIO_EJEMPLOS / 'casos-validacion-traza.json').read_text(encoding='utf-8'))


def construir_caso(caso: dict) -> dict:
    documento = copy.deepcopy(leer_traza_valida())
    for operacion in caso['operaciones']:
        ruta = (operacion.get('eliminar') or operacion.get('asignar')).split('.')
        nodo = documento
        for segmento in ruta[:-1]:
            nodo = nodo[int(segmento)] if isinstance(nodo, list) else nodo[segmento]
        if 'eliminar' in operacion:
            del nodo[ruta[-1]]
        else:
            nodo[ruta[-1]] = operacion['valor']
    return documento


@pytest.mark.parametrize('caso', CASOS['casos'], ids=[c['nombre'] for c in CASOS['casos']])
def test_caso_compartido_con_ajv(caso):
    validador = validador_de(leer_esquema('schemas/traza.schema.json'))
    errores = errores_esquema(validador, construir_caso(caso))
    assert (not errores) == caso['valida'], errores


def test_la_traza_sin_consumo_es_invalida_no_incompleta():
    esquema = leer_esquema('schemas/traza.schema.json')
    assert 'usage' in esquema['required']
    assert set(esquema['$defs']['consumo']['required']) >= {'input_tokens', 'output_tokens', 'llm_calls', 'cost_usd_est'}


def test_la_version_del_id_coincide_con_version_esquema():
    esquema = leer_esquema('schemas/traza.schema.json')
    assert esquema['$id'].rsplit(':', 1)[-1] == esquema['properties']['version_esquema']['const']


def test_la_lista_de_estados_finales_es_cerrada():
    esquema = leer_esquema('schemas/traza.schema.json')
    assert esquema['$defs']['resultado']['properties']['status']['enum'] == [
        'ok', 'timeout', 'limite_herramientas', 'error_agente', 'error_infraestructura', 'esquema_invalido',
    ]
