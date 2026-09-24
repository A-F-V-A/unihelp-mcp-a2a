"""Cliente HTTP de un backend de UniHelp, con las rutas de `libs/contratos`.

Es UNO para las cuatro arquitecturas: si el ejecutor hablara distinto con cada
una, una diferencia de medicion podria venir del cliente y no del protocolo
(regla de oro del experimento).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

RUTA_SALUD = '/health'
RUTA_MENSAJES = '/api/conversaciones/mensajes'
RUTA_RESTABLECER = '/experimento/restablecer'
RUTA_TRAZA = '/experimento/trazas/{trace_id}'


class ErrorBackend(RuntimeError):
    """El backend no respondio, o respondio algo que no es su contrato.

    `de_infraestructura` distingue el fallo que se reejecuta y se excluye del que
    cuenta como fallo de la arquitectura (RM-15). Solo son de infraestructura los
    que no atribuyen nada al agente: no hay conexion, se agoto el tiempo de red,
    o el backend devolvio 503.
    """

    def __init__(self, mensaje: str, *, de_infraestructura: bool) -> None:
        super().__init__(mensaje)
        self.de_infraestructura = de_infraestructura


@dataclass(frozen=True)
class RespuestaTurno:
    conversacion_id: str
    texto: str
    """`proponer-ticket` = el agente propuso y espera confirmacion (HU-13)."""
    accion_sugerida: str | None
    bloques: list[dict[str, Any]]
    clasificacion: dict[str, Any] | None

    @property
    def pidio_confirmacion(self) -> bool:
        return self.accion_sugerida == 'proponer-ticket'


def _texto_de(bloques: list[dict[str, Any]]) -> str:
    return '\n\n'.join(b.get('texto', '') for b in bloques if b.get('tipo') == 'texto').strip()


class ClienteBackend:
    def __init__(self, url_base: str, timeout_s: float) -> None:
        self._url = url_base.rstrip('/')
        self._http = httpx.Client(base_url=self._url, timeout=timeout_s)

    def __enter__(self) -> ClienteBackend:
        return self

    def __exit__(self, *_: object) -> None:
        self.cerrar()

    def cerrar(self) -> None:
        self._http.close()

    def _pedir(self, metodo: str, ruta: str, **kwargs: Any) -> Any:
        try:
            respuesta = self._http.request(metodo, ruta, **kwargs)
        except httpx.HTTPError as error:
            raise ErrorBackend(f'{metodo} {ruta}: {error}', de_infraestructura=True) from error
        if respuesta.status_code == 503:
            raise ErrorBackend(f'{metodo} {ruta}: 503', de_infraestructura=True)
        if respuesta.status_code >= 400:
            detalle = respuesta.text[:400]
            raise ErrorBackend(
                f'{metodo} {ruta}: {respuesta.status_code} {detalle}',
                de_infraestructura=False,
            )
        return respuesta.json()

    def salud(self) -> dict[str, Any]:
        return self._pedir('GET', RUTA_SALUD)

    def restablecer(self, estado_inicial: str, corpus: str) -> dict[str, Any]:
        """Deja el entorno como lo pide la tarea y devuelve la huella (HU-36)."""
        return self._pedir(
            'POST',
            RUTA_RESTABLECER,
            json={'estadoInicial': estado_inicial, 'corpus': corpus},
        )

    def enviar_turno(self, conversacion_id: str | None, texto: str, trace_id: str) -> RespuestaTurno:
        datos = self._pedir(
            'POST',
            RUTA_MENSAJES,
            json={'conversacionId': conversacion_id, 'texto': texto},
            headers={'X-Trace-Id': trace_id},
        )
        respuesta = datos['respuesta']
        bloques = list(respuesta.get('bloques') or [])
        return RespuestaTurno(
            conversacion_id=datos['conversacionId'],
            texto=_texto_de(bloques),
            accion_sugerida=datos.get('accionSugerida'),
            bloques=bloques,
            clasificacion=respuesta.get('clasificacion'),
        )

    def traza_parcial(self, trace_id: str) -> dict[str, Any]:
        """Lo que solo el backend sabe: tokens, desglose de latencia y auditoria."""
        return self._pedir('GET', RUTA_TRAZA.format(trace_id=trace_id))
