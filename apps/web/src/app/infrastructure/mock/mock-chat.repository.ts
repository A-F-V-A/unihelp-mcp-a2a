import { Injectable, inject } from '@angular/core';
import type {
  HistorialConversacionDto,
  MensajeAsistenteDto,
  MensajeUsuarioDto,
  RespuestaMensajeDto,
  ResumenConversacionDto,
} from '@unihelp/contratos';
import { LONGITUD_SOLICITUD } from '@unihelp/dominio';
import type {
  HistorialConversacion,
  RespuestaMensaje,
  ResumenConversacion,
  SolicitudMensaje,
} from '../../domain/models/conversacion';
import type { ChatRepository } from '../../domain/ports/chat.repository';
import {
  mapearHistorial,
  mapearRespuestaMensaje,
  mapearResumenConversacion,
} from '../mappers/conversacion.mapper';
import {
  BaseDatosSimulada,
  type EstadoBaseDatos,
  type RegistroConversacion,
  generarId,
  resumirConversacion,
} from './base-datos-simulada';
import { CONFIGURACION_SIMULACION } from './configuracion-simulacion';
import { falloApi } from './errores-api';
import { TEXTO_ULTIMO_TURNO } from './fixtures/escenarios.fixture';
import { generarRespuesta, recortarTitulo } from './motor-escenarios';
import { SimuladorRed } from './simulador-red';

@Injectable()
export class MockChatRepository implements ChatRepository {
  private readonly red = inject(SimuladorRed);
  private readonly bd = inject(BaseDatosSimulada);
  private readonly config = inject(CONFIGURACION_SIMULACION);

  async enviarMensaje(solicitud: SolicitudMensaje): Promise<RespuestaMensaje> {
    const dto = await this.red.responder(
      'enviarMensaje',
      () => this.registrarTurno(solicitud),
      solicitud.texto,
    );
    return mapearRespuestaMensaje(dto);
  }

  async obtenerHistorial(conversacionId: string): Promise<HistorialConversacion> {
    const dto = await this.red.responder('obtenerHistorial', () =>
      this.bd.consultar((estado): HistorialConversacionDto => {
        const conversacion = estado.conversaciones[conversacionId];
        if (!conversacion) {
          throw falloApi('no-encontrado', 'La conversación no existe o ya fue eliminada.', {
            conversacionId,
          });
        }
        return {
          conversacionId,
          mensajes: conversacion.mensajes,
          turnos: { usados: conversacion.turnosUsados, maximos: this.config.turnosMaximos },
        };
      }),
    );
    return mapearHistorial(dto);
  }

  async listarConversaciones(): Promise<readonly ResumenConversacion[]> {
    const dtos = await this.red.responder('listarConversaciones', () =>
      this.bd.consultar((estado): ResumenConversacionDto[] =>
        // Se invierte antes de ordenar para que, en empates, quede primero la mas nueva.
        Object.values(estado.conversaciones)
          .reverse()
          .map((conversacion) => resumirConversacion(conversacion, this.config.turnosMaximos))
          .sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn)),
      ),
    );
    return dtos.map(mapearResumenConversacion);
  }

  async eliminarConversacion(conversacionId: string): Promise<void> {
    await this.red.responder('eliminarConversacion', () => {
      this.bd.transaccion((estado) => {
        if (!estado.conversaciones[conversacionId]) {
          throw falloApi('no-encontrado', 'La conversación no existe o ya fue eliminada.', {
            conversacionId,
          });
        }
        delete estado.conversaciones[conversacionId];
      });
    });
  }

  /** Lo que haria el endpoint `POST /api/conversaciones/mensajes`. */
  private registrarTurno(solicitud: SolicitudMensaje): RespuestaMensajeDto {
    const texto = solicitud.texto.trim();
    if (texto.length < LONGITUD_SOLICITUD.minima || texto.length > LONGITUD_SOLICITUD.maxima) {
      throw falloApi(
        'validacion',
        `El texto debe tener entre ${LONGITUD_SOLICITUD.minima} y ${LONGITUD_SOLICITUD.maxima} caracteres.`,
        { campo: 'texto' },
      );
    }

    return this.bd.transaccion((estado) => {
      const maximos = this.config.turnosMaximos;
      const ahora = new Date();
      const conversacion = this.obtenerOCrear(estado, solicitud.conversacionId, ahora);

      if (conversacion.turnosUsados >= maximos) {
        throw falloApi('limite-turnos', `La conversación alcanzó el límite de ${maximos} turnos.`, {
          turnosMaximos: maximos,
        });
      }

      const turno = conversacion.turnosUsados + 1;
      const generada = generarRespuesta(texto, conversacion.ultimoEscenarioId, ahora);

      const mensajeUsuario: MensajeUsuarioDto = {
        id: generarId(estado, 'msg'),
        rol: 'usuario',
        turno,
        texto,
        enviadoEn: ahora.toISOString(),
      };

      const bloques = [...generada.bloques];
      if (turno === maximos) {
        bloques.push({ tipo: 'texto', texto: TEXTO_ULTIMO_TURNO });
      }

      const respuesta: MensajeAsistenteDto = {
        id: generarId(estado, 'msg'),
        rol: 'asistente',
        turno,
        clasificacion: generada.clasificacion,
        bloques,
        enviadoEn: ahora.toISOString(),
      };

      if (turno === 1) {
        conversacion.titulo = generada.titulo ?? recortarTitulo(texto);
      }
      conversacion.mensajes.push(mensajeUsuario, respuesta);
      conversacion.turnosUsados = turno;
      conversacion.actualizadaEn = ahora.toISOString();
      if (generada.escenarioId) {
        conversacion.ultimoEscenarioId = generada.escenarioId;
      }
      if (generada.propuesta) {
        conversacion.borradorPropuesta = generada.propuesta;
      }

      return {
        conversacionId: conversacion.id,
        conversacion: resumirConversacion(conversacion, maximos),
        mensajeUsuario,
        respuesta,
        turnos: { usados: turno, maximos },
        accionSugerida: generada.propuesta ? 'proponer-ticket' : null,
      };
    });
  }

  private obtenerOCrear(
    estado: EstadoBaseDatos,
    conversacionId: string | null,
    ahora: Date,
  ): RegistroConversacion {
    if (conversacionId) {
      const existente = estado.conversaciones[conversacionId];
      if (!existente) {
        throw falloApi('no-encontrado', 'La conversación no existe o ya fue eliminada.', {
          conversacionId,
        });
      }
      return existente;
    }

    const nueva: RegistroConversacion = {
      id: generarId(estado, 'conv'),
      titulo: '',
      creadaEn: ahora.toISOString(),
      actualizadaEn: ahora.toISOString(),
      mensajes: [],
      turnosUsados: 0,
      ultimoEscenarioId: null,
      borradorPropuesta: null,
    };
    estado.conversaciones[nueva.id] = nueva;
    return nueva;
  }
}
