"""Ciclo de una corrida: la matriz (tarea x arquitectura x repeticion).

Reglas de medicion que esta pieza sostiene:

- **RM-04 / D1.** Las ejecuciones corren UNA a la vez. Ademas de la regla, el
  restablecimiento es global: dos ejecuciones simultaneas se pisarian el estado.
- **RM-15.** Un fallo de infraestructura se marca `error_infraestructura` y queda
  apartado para reejecutar; cualquier otro fallo cuenta como fallo de la
  arquitectura y entra al conjunto.
- **HU-36 / M7.2.** Si la huella del estado inicial no es la esperada para la
  tarea, la ejecucion se ABORTA antes de gastar un solo token.
- **HU-38.** La traza se valida antes de persistirse; la invalida va a cuarentena.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from . import compuerta, traza as armado
from .cliente import ClienteBackend, ErrorBackend
from .configuracion import Configuracion, version_codigo
from .tareas import Tarea, cargar_tareas, huellas_esperadas, huellas_por_variante

ARCHIVO_TRAZAS = 'trazas.jsonl'
ARCHIVO_PUNTUACIONES = 'puntuaciones.jsonl'
ARCHIVO_HUELLAS = 'huellas-esperadas.json'
ARCHIVO_MANIFIESTO = 'manifiesto.json'
ARCHIVO_REEJECUCIONES = 'reejecuciones.md'
DIRECTORIO_CUARENTENA = 'cuarentena'


def _ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def _marca_run() -> str:
    return datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')


@dataclass
class ResultadoEjecucion:
    run_id: str
    task_id: str
    condicion: str
    repeticion: int
    estado: str
    valida: bool
    aprobada_compuerta: bool
    motivos: tuple[str, ...]
    """Motivos del rechazo de esquema; vacio si la traza valido."""
    errores_esquema: tuple[str, ...] = ()


@dataclass
class Corrida:
    """Escribe los artefactos de una corrida en su propio directorio."""

    configuracion: Configuracion
    directorio: Path
    version: str
    resultados: list[ResultadoEjecucion] = field(default_factory=list)

    @classmethod
    def crear(cls, configuracion: Configuracion, nombre: str | None = None) -> Corrida:
        directorio = configuracion.directorio_salida / (nombre or _marca_run())
        (directorio / DIRECTORIO_CUARENTENA).mkdir(parents=True, exist_ok=True)
        return cls(configuracion, directorio, version_codigo())

    def _agregar(self, archivo: str, objeto: dict[str, Any]) -> None:
        """Una linea por ejecucion, con `flush` inmediato: una corrida interrumpida
        conserva todo lo ya ejecutado (docs/05, paso 8)."""
        ruta = self.directorio / archivo
        with ruta.open('a', encoding='utf-8') as destino:
            destino.write(json.dumps(objeto, ensure_ascii=False) + '\n')
            destino.flush()

    def escribir_huellas(self, tareas: tuple[Tarea, ...]) -> None:
        (self.directorio / ARCHIVO_HUELLAS).write_text(
            json.dumps(huellas_esperadas(tareas, huellas_por_variante()), ensure_ascii=False, indent=2),
            encoding='utf-8',
        )

    def _leer_jsonl(self, archivo: str) -> list[dict[str, Any]]:
        ruta = self.directorio / archivo
        if not ruta.exists():
            return []
        return [
            json.loads(linea)
            for linea in ruta.read_text(encoding='utf-8').splitlines()
            if linea.strip()
        ]

    def escribir_manifiesto(self, _: tuple[Tarea, ...]) -> None:
        """Describe la CORRIDA, contando desde sus archivos y no desde la memoria.

        Una reejecucion agrega lineas a una corrida ya escrita (RM-15) y se
        invoca con `--tareas`, asi que ni los conteos ni la `config_hash` de esa
        invocacion describen la corrida. Los conteos se leen de los archivos y la
        `config_hash` original se conserva; la de cada reejecucion queda aparte,
        que es lo que hace falta para saber con que se produjo cada traza.
        """
        validas = self._leer_jsonl(ARCHIVO_TRAZAS)
        cuarentena = self._leer_jsonl(f'{DIRECTORIO_CUARENTENA}/{ARCHIVO_TRAZAS}')
        puntuaciones = self._leer_jsonl(ARCHIVO_PUNTUACIONES)
        infra = [
            registro
            for registro in cuarentena
            if registro.get('estado_original') == armado.ESTADO_ERROR_INFRA
        ]
        tareas_vistas = {t['task_id'] for t in validas} | {
            r['traza']['task_id'] for r in cuarentena
        }

        ruta = self.directorio / ARCHIVO_MANIFIESTO
        previo = json.loads(ruta.read_text(encoding='utf-8')) if ruta.exists() else {}
        huella = self.configuracion.huella_configuracion()
        reejecuciones = list(previo.get('reejecuciones') or [])
        if previo and huella != previo.get('config_hash'):
            reejecuciones.append({'en': _ahora_iso(), 'config_hash': huella})

        manifiesto = {
            'generado_en': previo.get('generado_en') or _ahora_iso(),
            'actualizado_en': _ahora_iso(),
            'version_codigo': self.version,
            'config_hash': previo.get('config_hash') or huella,
            'semilla': self.configuracion.semilla,
            'modo_llm': self.configuracion.modo_llm,
            'arquitecturas': list(self.configuracion.arquitecturas),
            'repeticiones': self.configuracion.repeticiones,
            'tareas': len(tareas_vistas),
            'ejecuciones': len(validas) + len(cuarentena),
            'trazas_validas': len(validas),
            'en_cuarentena': len(cuarentena),
            'compuerta_superada': sum(1 for p in puntuaciones if p.get('exito')),
            'fallos_de_infraestructura': [r['traza']['run_id'] for r in infra],
            # Se deja escrito para que un costo cero no se lea como un costo medido (M4.7).
            'tarifa_configurada': self.configuracion.tarifa.configurada,
            'juez': 'no_ejecutado',
            'reejecuciones': reejecuciones,
        }
        ruta.write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2), encoding='utf-8')
        if infra:
            tareas_afectadas = ','.join(sorted({r['traza']['task_id'] for r in infra}))
            cuerpo = [
                '# Reejecuciones pendientes',
                '',
                'Fallos de infraestructura: se reejecutan y se excluyen del conjunto (RM-15).',
                'La reejecucion agrega su traza a esta misma corrida; la de cuarentena no',
                'entra al conjunto oficial, asi que no queda una ejecucion duplicada.',
                '',
                '```bash',
                f'uv run python -m ejecutor correr --nombre {self.directorio.name} '
                f'--tareas {tareas_afectadas}',
                '```',
                '',
            ]
            for registro in infra:
                mensajes = '; '.join(e['mensaje'] for e in registro['traza'].get('errors') or [])
                cuerpo.append(f'- `{registro["traza"]["run_id"]}`: {mensajes}')
            cuerpo.append('')
            (self.directorio / ARCHIVO_REEJECUCIONES).write_text(
                '\n'.join(cuerpo), encoding='utf-8'
            )

    def registrar(self, traza: dict[str, Any], tarea: Tarea) -> ResultadoEjecucion:
        """Valida, persiste y puntua UNA ejecucion."""
        errores = armado.errores_de_esquema(traza)
        run_id = traza['run_id']
        if errores:
            # El estado ORIGINAL se conserva en el resultado aunque la traza se
            # marque `esquema_invalido`: sin el, un fallo de infraestructura
            # dejaria de aparecer en las reejecuciones y se perderia (RM-15).
            estado_original = traza['outcome']['status']
            traza['outcome']['status'] = 'esquema_invalido'
            self._agregar(
                f'{DIRECTORIO_CUARENTENA}/{ARCHIVO_TRAZAS}',
                {'traza': traza, 'errores': errores, 'estado_original': estado_original},
            )
            resultado = ResultadoEjecucion(
                run_id=run_id,
                task_id=tarea.id,
                condicion=traza['condition'],
                repeticion=traza['repetition'],
                estado=estado_original,
                valida=False,
                aprobada_compuerta=False,
                motivos=tuple(
                    e['mensaje'] for e in traza.get('errors') or []
                ) or ('esquema_invalido',),
                errores_esquema=tuple(errores),
            )
            self.resultados.append(resultado)
            return resultado

        self._agregar(ARCHIVO_TRAZAS, traza)
        puntuacion = compuerta.evaluar(
            traza,
            tarea.esperado,
            verificar_fidelidad_citacion=self.configuracion.verificar_fidelidad_citacion,
        )
        self._agregar(ARCHIVO_PUNTUACIONES, puntuacion.como_puntuacion(run_id))
        resultado = ResultadoEjecucion(
            run_id=run_id,
            task_id=tarea.id,
            condicion=traza['condition'],
            repeticion=traza['repetition'],
            estado=traza['outcome']['status'],
            valida=True,
            aprobada_compuerta=puntuacion.aprobada,
            motivos=puntuacion.motivos,
        )
        self.resultados.append(resultado)
        return resultado


class HuellaInesperadaError(RuntimeError):
    """El entorno no quedo como la tarea lo exige: la ejecucion no se corre (M7.2)."""


def ejecutar_una(
    *,
    tarea: Tarea,
    condicion: str,
    repeticion: int,
    cliente: ClienteBackend,
    configuracion: Configuracion,
    version: str,
    huella_esperada: str,
) -> dict[str, Any]:
    """Un ciclo completo. Devuelve la traza, valide o no."""
    marca = _marca_run()
    run_id = f'{tarea.id}|{condicion}|r{repeticion}|{marca}'
    trace_id = f'run-{marca}-{tarea.id}-{condicion}-r{repeticion}'
    conversacion = armado.Conversacion()
    inicio = _ahora_iso()

    def fallo(estado: str, tipo: str, mensaje: str, huella: str) -> dict[str, Any]:
        return armado.traza_de_fallo(
            run_id=run_id,
            trace_id=trace_id,
            task_id=tarea.id,
            condicion=condicion,
            repeticion=repeticion,
            huella_estado=huella,
            configuracion=configuracion,
            version_codigo=version,
            estado=estado,
            errores=[{'tipo': tipo, 'mensaje': mensaje}],
            conversacion=conversacion,
            inicio_iso=inicio,
            fin_iso=_ahora_iso(),
        )

    # 1. Restablecer y comprobar la huella ANTES de gastar tokens.
    try:
        entorno = cliente.restablecer(tarea.overlay, tarea.corpus)
    except ErrorBackend as error:
        estado = (
            armado.ESTADO_ERROR_INFRA if error.de_infraestructura else armado.ESTADO_ERROR_AGENTE
        )
        return fallo(estado, 'restablecimiento', str(error), huella_esperada)

    huella = entorno.get('huella', '')
    if huella != huella_esperada:
        # No es un fallo de la arquitectura: el entorno no era el pactado.
        return fallo(
            armado.ESTADO_ERROR_INFRA,
            'huella_inesperada',
            f'huella {huella} != esperada {huella_esperada} para {tarea.overlay}/{tarea.corpus}',
            huella or huella_esperada,
        )

    # 2. Turnos de la persona, uno a uno y en orden (RM-04).
    conversacion_id: str | None = None
    pidio_confirmacion = False
    try:
        for turno in tarea.turnos:
            if turno.condicion_de_envio is not None and not pidio_confirmacion:
                # El agente no propuso nada: el turno de confirmacion no tiene
                # sentido y enviarlo falsearia la conversacion.
                break
            conversacion.agregar('usuario', turno.texto)
            respuesta = cliente.enviar_turno(conversacion_id, turno.texto, trace_id)
            conversacion_id = respuesta.conversacion_id
            conversacion.agregar('agente', respuesta.texto)
            pidio_confirmacion = respuesta.pidio_confirmacion
    except ErrorBackend as error:
        if error.de_infraestructura:
            return fallo(armado.ESTADO_ERROR_INFRA, 'turno', str(error), huella)
        # El backend respondio un error de su contrato: es fallo del agente y cuenta.
        conversacion.agregar('agente', f'[error del backend] {error}')

    # 3. Lo que solo el backend sabe.
    try:
        parcial = cliente.traza_parcial(trace_id)
    except ErrorBackend as error:
        return fallo(armado.ESTADO_ERROR_INFRA, 'traza_parcial', str(error), huella)

    return armado.armar_traza(
        run_id=run_id,
        trace_id=trace_id,
        task_id=tarea.id,
        condicion=condicion,
        repeticion=repeticion,
        huella_estado=huella,
        configuracion=configuracion,
        version_codigo=version,
        parcial=parcial,
        conversacion=conversacion,
        objeto_final=parcial.get('final_json'),
        inicio_iso=inicio,
        fin_iso=_ahora_iso(),
        errores=[],
    )


def matriz(
    tareas: tuple[Tarea, ...], configuracion: Configuracion
) -> list[tuple[Tarea, str, int]]:
    """Las ejecuciones en orden aleatorizado con la semilla de la corrida (docs/05, 2).

    El orden se aleatoriza para que un efecto de deriva del proveedor no quede
    correlacionado con la arquitectura ni con la categoria de la tarea.
    """
    combinaciones = [
        (tarea, arquitectura, repeticion)
        for tarea in tareas
        for arquitectura in configuracion.arquitecturas
        if arquitectura in tarea.arquitecturas
        for repeticion in range(1, configuracion.repeticiones + 1)
    ]
    random.Random(configuracion.semilla).shuffle(combinaciones)
    return combinaciones


def correr(
    configuracion: Configuracion,
    *,
    nombre: str | None = None,
    informar: Callable[[str], None] = print,
) -> Corrida:
    """Corre la matriz completa y deja la corrida lista para el cuaderno."""
    todas = cargar_tareas()
    seleccion = (
        tuple(t for t in todas if t.id in configuracion.tareas) if configuracion.tareas else todas
    )
    if not seleccion:
        raise ValueError('La seleccion de tareas quedo vacia.')

    variantes = huellas_por_variante()
    corrida = Corrida.crear(configuracion, nombre)
    corrida.escribir_huellas(seleccion)
    informar(f'Corrida en {corrida.directorio} ({corrida.version})')

    pendientes = matriz(seleccion, configuracion)
    informar(f'{len(pendientes)} ejecuciones; modo {configuracion.modo_llm}')

    clientes = {
        arquitectura: ClienteBackend(
            configuracion.url_de(arquitectura), configuracion.timeout_http_s
        )
        for arquitectura in configuracion.arquitecturas
    }
    try:
        for indice, (tarea, arquitectura, repeticion) in enumerate(pendientes, start=1):
            huella = variantes[(tarea.overlay, tarea.corpus)]
            traza = ejecutar_una(
                tarea=tarea,
                condicion=arquitectura,
                repeticion=repeticion,
                cliente=clientes[arquitectura],
                configuracion=configuracion,
                version=corrida.version,
                huella_esperada=huella,
            )
            resultado = corrida.registrar(traza, tarea)
            marca = 'OK ' if resultado.aprobada_compuerta else '-- '
            detalle = resultado.estado if resultado.valida else 'cuarentena'
            motivos = f' [{"; ".join(resultado.motivos)}]' if resultado.motivos else ''
            informar(
                f'{indice:>3}/{len(pendientes)} {marca}{tarea.id} {arquitectura} '
                f'r{repeticion} {detalle}{motivos}'
            )
    finally:
        for cliente in clientes.values():
            cliente.cerrar()

    corrida.escribir_manifiesto(seleccion)
    return corrida


def repuntuar(
    directorio: Path,
    configuracion: Configuracion,
    *,
    informar: Callable[[str], None] = print,
) -> dict[str, int]:
    """Recalcula `puntuaciones.jsonl` desde `trazas.jsonl`, sin volver a ejecutar.

    La traza es el artefacto duradero; la puntuacion es derivada. Cuando cambia
    una verificacion de la compuerta hay que poder recalcular el exito de una
    corrida ya pagada, en vez de gastar otra vez el modelo. Reescribe el archivo
    completo: una puntuacion a medias seria peor que ninguna.
    """
    ruta_trazas = directorio / ARCHIVO_TRAZAS
    if not ruta_trazas.exists():
        raise ValueError(f'No hay {ARCHIVO_TRAZAS} en {directorio}.')
    por_id = {tarea.id: tarea for tarea in cargar_tareas()}

    lineas: list[str] = []
    conteo = {'ejecuciones': 0, 'aprobadas': 0}
    for linea in ruta_trazas.read_text(encoding='utf-8').splitlines():
        if not linea.strip():
            continue
        traza = json.loads(linea)
        tarea = por_id.get(traza['task_id'])
        if tarea is None:
            raise ValueError(f'{traza["run_id"]}: la tarea {traza["task_id"]} ya no existe.')
        resultado = compuerta.evaluar(
            traza,
            tarea.esperado,
            verificar_fidelidad_citacion=configuracion.verificar_fidelidad_citacion,
        )
        conteo['ejecuciones'] += 1
        conteo['aprobadas'] += int(resultado.aprobada)
        lineas.append(json.dumps(resultado.como_puntuacion(traza['run_id']), ensure_ascii=False))

    (directorio / ARCHIVO_PUNTUACIONES).write_text('\n'.join(lineas) + '\n', encoding='utf-8')
    # El manifiesto declara cuantas superaron la compuerta: si se repuntua y no
    # se reescribe, queda diciendo el numero de la puntuacion anterior.
    Corrida(configuracion, directorio, version_codigo()).escribir_manifiesto(())
    informar(
        f'{conteo["ejecuciones"]} ejecuciones repuntuadas; '
        f'{conteo["aprobadas"]} superan la compuerta automatica.'
    )
    return conteo
