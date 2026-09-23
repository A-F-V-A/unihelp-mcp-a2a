import type { ComponentesDeServicio } from '@unihelp/conocimiento';
import type { ComponenteEmuladoDto, EstadoSistemaEmuladoDto } from '@unihelp/contratos';
import { ESTADO_SERVICIO_PUBLICADO } from '@unihelp/dominio';

/**
 * Traduce lo que guarda la base de conocimiento al vocabulario que publica un
 * sistema (`OPERATIVO`, `DEGRADADO`, `FUERA_DE_SERVICIO`, `MANTENIMIENTO`), que
 * es el mismo de `estado_inicial.servicios` en las tareas. La traduccion vive
 * en `@unihelp/dominio` para que el simulador y las cuatro arquitecturas digan
 * exactamente lo mismo (decision 16).
 *
 * El comunicado viaja SIN sanear y sin envolver: aqui es la salida de un
 * sistema externo, no la entrada de un modelo. Quien lo consuma es responsable
 * de delimitarlo antes de ponerlo en un prompt, como ya hace el adaptador de
 * `consultar_estado_servicio` (T-ADV-007).
 */
export function aEstadoSistemaDto(resultado: ComponentesDeServicio): EstadoSistemaEmuladoDto {
  const { estado, componentes } = resultado;
  return {
    estado: ESTADO_SERVICIO_PUBLICADO[estado.estado],
    alcance: estado.alcance,
    componentes_afectados: componentes
      .filter((componente) => componente.estado !== 'operativo')
      .map((componente) => componente.codigo),
    mensaje: estado.mensaje,
    ventana_estimada: estado.ventanaEstimada,
    incidente_ref: estado.incidenteRef,
    desde: estado.desde,
  };
}

export function aComponenteDto(
  componente: ComponentesDeServicio['componentes'][number],
): ComponenteEmuladoDto {
  return {
    codigo: componente.codigo,
    nombre: componente.nombre,
    estado: ESTADO_SERVICIO_PUBLICADO[componente.estado],
    ventanaEstimada: componente.ventanaEstimada,
    incidenteRef: componente.incidenteRef,
    actualizadoEn: componente.actualizadoEn,
  };
}
