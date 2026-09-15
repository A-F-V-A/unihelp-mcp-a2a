"""Carga y valida `experiment/metricas.yaml` (HU-MET-02, HU-MET-03).

El registro es la unica fuente de los nombres de campo: el codigo de calculo pide
un alias (`metrica.columna('latencia')`) y el registro devuelve la columna del
artefacto. Asi, renombrar un campo de la traza obliga a tocar un solo archivo y
nunca deja una metrica leyendo un campo que ya no existe.
"""

from __future__ import annotations

import json
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator

RAIZ_EXPERIMENTO = Path(__file__).resolve().parent.parent
RAIZ_REPOSITORIO = RAIZ_EXPERIMENTO.parent
RUTA_REGISTRO = RAIZ_EXPERIMENTO / 'metricas.yaml'
DIRECTORIO_ESQUEMAS = RAIZ_EXPERIMENTO / 'schemas'
DIRECTORIO_TAREAS = RAIZ_REPOSITORIO / 'docs' / 'tasks'

# Nombre del artefacto cuyo esquema es la traza; sus campos se verifican contra el.
ARTEFACTO_TRAZA = 'traza'
MARCA_ARREGLO = '[]'


class ErrorRegistro(ValueError):
    """El registro de metricas no es coherente con sus esquemas o consigo mismo."""


def columna(artefacto: str, campo: str) -> str:
    """Nombre de columna consolidada: `artefacto:campo`. Evita choques entre artefactos."""
    return f'{artefacto}:{campo}'


@cache
def leer_esquema(relativa: str) -> dict[str, Any]:
    """Lee un esquema de `experiment/`. Acepta `archivo.json#/$defs/nombre`."""
    archivo, _, puntero = relativa.partition('#')
    esquema = json.loads((RAIZ_EXPERIMENTO / archivo).read_text(encoding='utf-8'))
    if not puntero:
        return esquema
    # Un esquema raiz con `$ref` local conserva `$defs` para que resuelvan las referencias internas.
    return {'$schema': esquema['$schema'], '$defs': esquema['$defs'], '$ref': f'#{puntero}'}


def _resolver(esquema_raiz: Mapping[str, Any], nodo: Mapping[str, Any]) -> Mapping[str, Any]:
    while '$ref' in nodo:
        ruta = nodo['$ref'].removeprefix('#/').split('/')
        destino: Any = esquema_raiz
        for parte in ruta:
            destino = destino[parte]
        nodo = {**destino, **{k: v for k, v in nodo.items() if k != '$ref'}}
    return nodo


def campo_existe(esquema: Mapping[str, Any], ruta: str) -> bool:
    """Indica si `ruta` (con puntos y `[]` para arreglos) esta declarada en el esquema.

    Un objeto sin `additionalProperties: false` y sin la propiedad pedida se
    considera de forma libre (por ejemplo `outcome.final_json`): la ruta se acepta.
    """
    nodo = _resolver(esquema, esquema)
    for segmento in ruta.split('.'):
        es_arreglo = segmento.endswith(MARCA_ARREGLO)
        nombre = segmento.removesuffix(MARCA_ARREGLO)
        propiedades = nodo.get('properties', {})
        if nombre in propiedades:
            nodo = _resolver(esquema, propiedades[nombre])
        elif nodo.get('additionalProperties', True) is False:
            return False
        else:
            return True
        if es_arreglo:
            if 'items' not in nodo:
                return False
            nodo = _resolver(esquema, nodo['items'])
    return True


def rutas_esquema(esquema: Mapping[str, Any]) -> set[str]:
    """Todas las rutas declaradas en un esquema (`a`, `a.b`, `a[].c`). Las usan las pruebas."""
    rutas: set[str] = set()

    def recorrer(nodo: Mapping[str, Any], prefijo: str, profundidad: int) -> None:
        if profundidad > 12:
            return
        nodo = _resolver(esquema, nodo)
        for nombre, hijo in nodo.get('properties', {}).items():
            ruta = f'{prefijo}.{nombre}' if prefijo else nombre
            rutas.add(ruta)
            hijo = _resolver(esquema, hijo)
            recorrer(hijo, ruta, profundidad + 1)
            if 'items' in hijo:
                recorrer(hijo['items'], ruta + MARCA_ARREGLO, profundidad + 1)

    recorrer(esquema, '', 0)
    return rutas


@dataclass(frozen=True)
class Fuente:
    """De que artefacto sale un dato y con que alias lo conoce el codigo."""

    artefacto: str
    campos: Mapping[str, str]


@dataclass(frozen=True)
class Metrica:
    """Ficha de una metrica tal como la declara el registro."""

    datos: Mapping[str, Any]
    fuentes: tuple[Fuente, ...]

    @property
    def codigo(self) -> str:
        return self.datos['codigo']

    @property
    def familia(self) -> str:
        return self.datos['familia']

    @property
    def rol(self) -> str:
        return self.datos['rol']

    @property
    def tipo_valor_esperado(self) -> str:
        return self.datos['tipo_valor_esperado']

    @property
    def valor_umbral(self) -> Mapping[str, Any] | None:
        return self.datos.get('valor_umbral')

    @property
    def implementacion(self) -> Mapping[str, Any]:
        return self.datos['implementacion']

    @property
    def implementada(self) -> bool:
        return self.implementacion['estado'] == 'implementada'

    @property
    def agregacion_tareas(self) -> str | None:
        return self.implementacion.get('agregacion_tareas')

    @property
    def poblacion(self) -> str | None:
        return self.implementacion.get('poblacion')

    @property
    def con_intervalo(self) -> bool:
        return self.implementacion.get('intervalo') == 'bootstrap_tareas'

    @property
    def con_contrastes(self) -> bool:
        return bool(self.implementacion.get('contrastes'))

    def parametro(self, nombre: str) -> Any:
        parametros = self.implementacion.get('parametros', {})
        if nombre not in parametros:
            raise ErrorRegistro(f'{self.codigo}: falta implementacion.parametros.{nombre}')
        return parametros[nombre]

    def campo(self, alias: str, artefacto: str | None = None) -> str:
        """Campo exacto del artefacto que corresponde a `alias`."""
        return self._buscar(alias, artefacto)[1]

    def subcampo(self, alias: str, artefacto: str | None = None) -> str:
        """Nombre del campo dentro de cada elemento: `transportes[].nombre` -> `nombre`."""
        return self.campo(alias, artefacto).rsplit(MARCA_ARREGLO + '.', 1)[-1]

    def columna(self, alias: str, artefacto: str | None = None) -> str:
        """Columna consolidada (`artefacto:campo`) que corresponde a `alias`."""
        return columna(*self._buscar(alias, artefacto))

    def _buscar(self, alias: str, artefacto: str | None) -> tuple[str, str]:
        hallados = [
            (f.artefacto, f.campos[alias])
            for f in self.fuentes
            if alias in f.campos and (artefacto is None or f.artefacto == artefacto)
        ]
        if not hallados:
            raise ErrorRegistro(f'{self.codigo}: el alias "{alias}" no esta en su fuente')
        if len(hallados) > 1:
            raise ErrorRegistro(
                f'{self.codigo}: el alias "{alias}" aparece en varios artefactos; indique cual'
            )
        return hallados[0]


@dataclass(frozen=True)
class Registro:
    """Registro de metricas ya validado."""

    datos: Mapping[str, Any]
    metricas: tuple[Metrica, ...]

    @property
    def version(self) -> str:
        return self.datos['version_registro']

    @property
    def arquitecturas(self) -> tuple[str, ...]:
        return tuple(self.datos['arquitecturas'])

    @property
    def categorias(self) -> tuple[str, ...]:
        return tuple(self.datos['categorias']['valores'])

    @property
    def campo_categoria(self) -> str:
        """Campo del YAML de la tarea que da su categoria."""
        return self.datos['categorias']['campo']

    @property
    def estado_inicial(self) -> Mapping[str, str]:
        return self.validaciones['estado_inicial']

    @property
    def inferencia(self) -> Mapping[str, Any]:
        return self.datos['inferencia']

    @property
    def validaciones(self) -> Mapping[str, Any]:
        return self.datos['validaciones']

    @property
    def artefactos(self) -> Mapping[str, Mapping[str, Any]]:
        return self.datos['artefactos']

    def metrica(self, codigo: str) -> Metrica:
        for m in self.metricas:
            if m.codigo == codigo:
                return m
        raise ErrorRegistro(f'La metrica {codigo} no esta en el registro')

    def implementadas(self) -> tuple[Metrica, ...]:
        return tuple(m for m in self.metricas if m.implementada)

    def campo_identidad(self, nombre: str) -> str:
        return self.datos['identidad'][nombre]

    def columna_identidad(self, nombre: str) -> str:
        return columna(ARTEFACTO_TRAZA, self.campo_identidad(nombre))

    def columnas_identidad(self) -> dict[str, str]:
        return {n: self.columna_identidad(n) for n in self.datos['identidad']}

    def campo_procedencia(self, nombre: str) -> str:
        return self.datos['procedencia'][nombre]

    @property
    def campo_estado_final(self) -> str:
        return self.datos['estados_finales']['campo']

    @property
    def columna_estado_final(self) -> str:
        return columna(ARTEFACTO_TRAZA, self.campo_estado_final)

    def tratamiento(self) -> Mapping[str, Mapping[str, Any]]:
        return self.datos['estados_finales']['tratamiento']

    def estados_donde(self, dimension: str, *valores: str) -> tuple[str, ...]:
        """Estados finales cuyo tratamiento en `dimension` es alguno de `valores` (seccion 13)."""
        return tuple(e for e, t in self.tratamiento().items() if t[dimension] in valores)

    def estados_reejecutables(self) -> tuple[str, ...]:
        return tuple(e for e, t in self.tratamiento().items() if t['reejecutar'])

    def ruta_artefacto(self, nombre: str, directorio_corrida: Path) -> Path | None:
        archivo = self.artefactos[nombre].get('archivo')
        return None if archivo is None else directorio_corrida / archivo

    def esquema_artefacto(self, nombre: str) -> dict[str, Any] | None:
        relativa = self.artefactos[nombre].get('esquema')
        return None if relativa is None else leer_esquema(relativa)

    def es_artefacto_traza(self, nombre: str) -> bool:
        return self.artefactos[nombre].get('esquema') == self.artefactos[ARTEFACTO_TRAZA]['esquema']

    def campos_traza_requeridos(self) -> tuple[str, ...]:
        """Campos escalares de la traza que la carga debe extraer, en orden estable."""
        campos: set[str] = set(self.datos['identidad'].values())
        campos.update(self.datos['procedencia'].values())
        campos.add(self.campo_estado_final)
        residuo = self.validaciones['residuo_orquestacion']
        campos.update([residuo['total'], residuo['reportado'], *residuo['componentes']])
        campos.update(self.validaciones['consumo_tokens']['campos'])
        campos.add(self.estado_inicial['huella'])
        for metrica in self.implementadas():
            for fuente in metrica.fuentes:
                if fuente.artefacto == ARTEFACTO_TRAZA:
                    campos.update(c for c in fuente.campos.values() if MARCA_ARREGLO not in c)
        return tuple(sorted(campos))

    def campos_de_artefacto(self, artefacto: str) -> tuple[str, ...]:
        """Campos de `artefacto` que usan las metricas implementadas."""
        campos = {
            c
            for m in self.implementadas()
            for f in m.fuentes
            if f.artefacto == artefacto
            for c in f.campos.values()
        }
        return tuple(sorted(campos))


def _rutas_de_traza_declaradas(datos: Mapping[str, Any]) -> Iterator[tuple[str, str]]:
    """(donde, ruta) de cada campo de traza que menciona el registro fuera de las metricas."""
    for nombre, ruta in datos['identidad'].items():
        yield f'identidad.{nombre}', ruta
    for nombre, ruta in datos['procedencia'].items():
        yield f'procedencia.{nombre}', ruta
    yield 'estados_finales.campo', datos['estados_finales']['campo']
    residuo = datos['validaciones']['residuo_orquestacion']
    for ruta in [residuo['total'], residuo['reportado'], *residuo['componentes']]:
        yield 'validaciones.residuo_orquestacion', ruta
    for ruta in datos['validaciones']['consumo_tokens']['campos']:
        yield 'validaciones.consumo_tokens', ruta
    yield 'validaciones.estado_inicial.huella', datos['validaciones']['estado_inicial']['huella']


def _verificar_coherencia(registro: Registro) -> list[str]:
    errores: list[str] = []
    datos = registro.datos
    esquema_traza = registro.esquema_artefacto(ARTEFACTO_TRAZA)
    assert esquema_traza is not None

    codigos = [m.codigo for m in registro.metricas]
    for codigo in sorted({c for c in codigos if codigos.count(c) > 1}):
        errores.append(f'codigo repetido: {codigo}')

    for donde, ruta in _rutas_de_traza_declaradas(datos):
        if not campo_existe(esquema_traza, ruta):
            errores.append(f'{donde}: el campo "{ruta}" no existe en traza.schema.json')

    # La tabla de tratamiento debe cubrir EXACTAMENTE la lista cerrada de estados del esquema.
    estados_esquema = set(esquema_traza['$defs']['resultado']['properties']['status']['enum'])
    estados_tabla = set(registro.tratamiento())
    if estados_esquema != estados_tabla:
        errores.append(
            'estados_finales.tratamiento no coincide con el enum de estados del esquema: '
            f'faltan {sorted(estados_esquema - estados_tabla)}, sobran {sorted(estados_tabla - estados_esquema)}'
        )

    for par in registro.inferencia['contrastes']:
        for arquitectura in par:
            if arquitectura not in registro.arquitecturas:
                errores.append(f'inferencia.contrastes: {arquitectura} no esta en arquitecturas')

    for metrica in registro.metricas:
        codigo = metrica.codigo
        if codigo.split('.')[0] != metrica.familia:
            errores.append(f'{codigo}: la familia {metrica.familia} no coincide con el codigo')
        for fuente in metrica.fuentes:
            if fuente.artefacto not in registro.artefactos:
                errores.append(f'{codigo}: artefacto desconocido "{fuente.artefacto}"')
                continue
            if registro.es_artefacto_traza(fuente.artefacto):
                for ruta in fuente.campos.values():
                    if not campo_existe(esquema_traza, ruta):
                        errores.append(f'{codigo}: el campo "{ruta}" no existe en traza.schema.json')
        if metrica.implementada:
            if metrica.con_intervalo and metrica.agregacion_tareas is None:
                errores.append(f'{codigo}: un intervalo por tareas exige agregacion_tareas')
            for fuente in metrica.fuentes:
                esquema = registro.esquema_artefacto(fuente.artefacto)
                if esquema is None or registro.es_artefacto_traza(fuente.artefacto):
                    continue
                for ruta in fuente.campos.values():
                    if not campo_existe(esquema, ruta):
                        errores.append(
                            f'{codigo}: el campo "{ruta}" no existe en el esquema de {fuente.artefacto}'
                        )
    return errores


def cargar_registro(ruta: Path = RUTA_REGISTRO) -> Registro:
    """Lee el registro, lo valida contra su esquema y verifica su coherencia.

    Falla con TODOS los errores juntos: un registro incoherente no produce metricas.
    """
    datos = yaml.safe_load(ruta.read_text(encoding='utf-8'))
    validador = Draft202012Validator(leer_esquema('schemas/metricas.schema.json'))
    errores = [
        f'{"/".join(map(str, e.absolute_path)) or "(raiz)"}: {e.message}'
        for e in validador.iter_errors(datos)
    ]
    if errores:
        raise ErrorRegistro('metricas.yaml no valida contra su esquema:\n  ' + '\n  '.join(sorted(errores)))

    metricas = tuple(
        Metrica(
            datos=m,
            fuentes=tuple(Fuente(f['artefacto'], dict(f['campos'])) for f in m['fuente']),
        )
        for m in datos['metricas']
    )
    registro = Registro(datos=datos, metricas=metricas)
    errores = _verificar_coherencia(registro)
    if errores:
        raise ErrorRegistro('metricas.yaml es incoherente:\n  ' + '\n  '.join(errores))
    return registro
