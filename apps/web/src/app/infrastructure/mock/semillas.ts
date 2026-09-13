import type { MensajeAsistenteDto, MensajeUsuarioDto } from '@unihelp/contratos';
import { type EstadoBaseDatos, type RegistroConversacion, generarId } from './estado-base-datos';
import { CONVERSACIONES_PREVIAS } from './fixtures/conversaciones-previas.fixture';
import { generarRespuesta } from './motor-escenarios';

const MINUTO_MS = 60_000;

/**
 * Carga conversaciones de dias anteriores, construidas con el mismo motor que
 * responde en vivo, para que el historial se pueda probar desde el primer uso.
 */
export function sembrarConversaciones(
  estado: EstadoBaseDatos,
  turnosMaximos: number,
  ahora: Date,
): void {
  for (const previa of CONVERSACIONES_PREVIAS) {
    const inicio = new Date(ahora.getTime() - previa.haceMinutos * MINUTO_MS);
    const registro: RegistroConversacion = {
      id: generarId(estado, 'conv'),
      titulo: previa.titulo,
      creadaEn: inicio.toISOString(),
      actualizadaEn: inicio.toISOString(),
      mensajes: [],
      turnosUsados: 0,
      ultimoEscenarioId: null,
      borradorPropuesta: null,
    };

    previa.mensajes.slice(0, turnosMaximos).forEach((texto, indice) => {
      const momento = new Date(inicio.getTime() + indice * 2 * MINUTO_MS);
      const turno = indice + 1;
      const generada = generarRespuesta(texto, registro.ultimoEscenarioId, momento);

      const usuario: MensajeUsuarioDto = {
        id: generarId(estado, 'msg'),
        rol: 'usuario',
        turno,
        texto,
        enviadoEn: momento.toISOString(),
      };
      const asistente: MensajeAsistenteDto = {
        id: generarId(estado, 'msg'),
        rol: 'asistente',
        turno,
        clasificacion: generada.clasificacion,
        bloques: generada.bloques,
        enviadoEn: momento.toISOString(),
      };

      registro.mensajes.push(usuario, asistente);
      registro.turnosUsados = turno;
      registro.actualizadaEn = momento.toISOString();
      if (generada.escenarioId) {
        registro.ultimoEscenarioId = generada.escenarioId;
      }
    });

    estado.conversaciones[registro.id] = registro;
  }
}
