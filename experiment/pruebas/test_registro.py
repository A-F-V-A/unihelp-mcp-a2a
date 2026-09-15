"""El registro de metricas es coherente con el plan, con los esquemas y con el codigo (HU-MET-02)."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from analisis.familias import calcular, comun, diferencias_con_registro
from analisis.registro import RUTA_REGISTRO, ErrorRegistro, cargar_registro

IMPLEMENTADAS_ESPERADAS = {
    *(f'M1.{i}' for i in range(1, 6)),
    *(f'M4.{i}' for i in range(1, 8)),
    *(f'M7.{i}' for i in range(1, 8)),
}


def _registro_modificado(tmp_path: Path, modificar) -> Path:
    datos = yaml.safe_load(RUTA_REGISTRO.read_text(encoding='utf-8'))
    modificar(datos)
    ruta = tmp_path / 'metricas.yaml'
    ruta.write_text(yaml.safe_dump(datos, allow_unicode=True, sort_keys=False), encoding='utf-8')
    return ruta


def _metrica(datos: dict, codigo: str) -> dict:
    return next(m for m in datos['metricas'] if m['codigo'] == codigo)


def test_declara_las_43_metricas_del_plan_con_17_primarias_y_7_de_control(registro):
    roles = [m.rol for m in registro.metricas]
    assert len(registro.metricas) == 43
    assert roles.count('primaria') == 17
    assert roles.count('control') == 7
    assert {m.familia for m in registro.metricas} == {f'M{i}' for i in range(1, 8)}


def test_implementadas_son_exactamente_m1_m4_y_m7(registro):
    assert {m.codigo for m in registro.implementadas()} == IMPLEMENTADAS_ESPERADAS


def test_toda_metrica_implementada_tiene_funcion_y_toda_funcion_tiene_ficha(registro):
    assert diferencias_con_registro(registro) == ([], [])


def test_falla_si_el_registro_declara_implementada_una_metrica_sin_funcion(tmp_path, contexto):
    def marcar(datos):
        _metrica(datos, 'M2.1')['implementacion'] = {
            'estado': 'implementada',
            'poblacion': 'efectividad',
            'agregacion_tareas': 'media',
            'intervalo': 'bootstrap_tareas',
            'contrastes': False,
        }

    registro = cargar_registro(_registro_modificado(tmp_path, marcar))
    assert diferencias_con_registro(registro) == (['M2.1'], [])
    with pytest.raises(ErrorRegistro, match='M2.1'):
        calcular(type(contexto)(**{**contexto.__dict__, 'registro': registro}))


def test_falla_si_hay_una_funcion_para_una_metrica_que_no_esta_en_el_registro(registro, monkeypatch):
    monkeypatch.setitem(comun._IMPLEMENTACIONES, 'M9.1', lambda metrica, ctx: None)
    assert diferencias_con_registro(registro) == ([], ['M9.1'])


def test_falla_si_hay_una_funcion_para_una_metrica_pendiente(registro, monkeypatch):
    monkeypatch.setitem(comun._IMPLEMENTACIONES, 'M5.1', lambda metrica, ctx: None)
    assert diferencias_con_registro(registro) == ([], ['M5.1'])


def test_un_campo_de_traza_inexistente_invalida_el_registro(tmp_path):
    def romper(datos):
        _metrica(datos, 'M4.1')['fuente'][0]['campos']['latencia'] = 'timing.total_milisegundos'

    with pytest.raises(ErrorRegistro, match='timing.total_milisegundos'):
        cargar_registro(_registro_modificado(tmp_path, romper))


def test_valor_umbral_existe_si_y_solo_si_el_tipo_es_umbral(tmp_path, registro):
    for metrica in registro.metricas:
        assert (metrica.valor_umbral is not None) == (metrica.tipo_valor_esperado == 'umbral'), metrica.codigo

    def umbral_en_abierta(datos):
        _metrica(datos, 'M1.1')['valor_umbral'] = {'operador': '>=', 'valor': 0.8, 'descripcion': 'x'}

    with pytest.raises(ErrorRegistro):
        cargar_registro(_registro_modificado(tmp_path, umbral_en_abierta))


def test_la_tabla_de_estados_finales_cubre_la_lista_cerrada_del_esquema(tmp_path):
    def quitar_estado(datos):
        del datos['estados_finales']['tratamiento']['timeout']

    with pytest.raises(ErrorRegistro, match='timeout'):
        cargar_registro(_registro_modificado(tmp_path, quitar_estado))


def test_la_familia_debe_coincidir_con_el_codigo(tmp_path):
    def cambiar_familia(datos):
        _metrica(datos, 'M4.4')['familia'] = 'M1'

    with pytest.raises(ErrorRegistro, match='M4.4'):
        cargar_registro(_registro_modificado(tmp_path, cambiar_familia))


def test_las_metricas_de_control_no_sirven_a_ninguna_hipotesis(registro):
    for metrica in registro.metricas:
        if metrica.rol == 'control':
            assert metrica.datos['hipotesis'] == ['ninguna'], metrica.codigo
