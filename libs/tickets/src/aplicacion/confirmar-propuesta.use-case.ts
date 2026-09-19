import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorTickets } from '../dominio/errores';
import type { Confirmacion, Propuesta } from '../dominio/modelos';
import type { TicketsRepository } from '../dominio/puertos/tickets.repository';
import { clasificarAfirmacion, claveTranscripcion } from '../dominio/reglas/afirmacion.rules';
import { RegistroAuditoria } from './registro-auditoria';
import {
  type ContextoOperacion,
  RELOJ_TICKETS,
  type RelojTickets,
  TICKETS_REPOSITORY,
} from './tokens';

/** Resultado de `confirmar_propuesta` (docs/02, 2.4). */
export interface ResultadoConfirmacion {
  readonly aceptada: boolean;
  /** Solo si `aceptada`. Se entrega UNA vez: la base guarda solo su huella. */
  readonly confirmacionToken: string | null;
  readonly motivoRechazo: string | null;
  readonly propuesta: Propuesta;
}

/** `sha256:<hex>` de un token. El valor del token nunca se guarda. */
export function huellaToken(token: string): string {
  return `sha256:${createHash('sha256').update(token, 'utf8').digest('hex')}`;
}

/**
 * Emite el token de confirmacion. Es la UNICA fuente de tokens: sin su token no
 * hay ticket (HU-16). Lo emite solo ante una autorizacion real de la persona:
 * un turno que ella escribio (verificado contra el registro de turnos) y que el
 * clasificador determinista reconoce como afirmacion (HU-14), o la accion
 * explicita del boton del frontend (decision 13).
 */
@Injectable()
export class ConfirmarPropuestaUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly repositorio: TicketsRepository,
    @Inject(RELOJ_TICKETS) private readonly reloj: RelojTickets,
    @Inject(RegistroAuditoria) private readonly auditoria: RegistroAuditoria,
  ) {}

  /**
   * Camino de la conversacion: el texto debe coincidir con un turno real de la
   * persona posterior a la propuesta. Una negativa descarta la propuesta (HU-15).
   */
  async porTexto(
    propuestaId: string,
    texto: string,
    contexto: ContextoOperacion,
  ): Promise<ResultadoConfirmacion> {
    const propuesta = await this.propuestaConfirmable(propuestaId, contexto);
    const cuerpo = { propuestaId, texto };

    const turnos = await this.repositorio.listarTurnos(
      propuesta.conversacionId,
      propuesta.creadaEn,
    );
    const buscado = claveTranscripcion(texto);
    if (!turnos.some((turno) => claveTranscripcion(turno.texto) === buscado)) {
      return this.rechazar(
        propuesta,
        'El texto de confirmación no corresponde a ningún mensaje que la persona haya escrito después de la propuesta.',
        contexto,
        cuerpo,
      );
    }

    const clasificacion = clasificarAfirmacion(texto);
    if (clasificacion === 'negacion') {
      const ahora = this.reloj.ahora();
      await this.repositorio.actualizarPropuesta(propuesta.id, {
        estado: 'rechazada',
        resueltaEn: ahora,
        ticketNumero: null,
      });
      await this.auditoria.registrar({
        ...contexto,
        accion: 'ticket.confirm',
        recurso: propuesta.id,
        resultado: 'RECHAZADO',
        motivo: 'La persona rechazó la propuesta.',
        cuerpo,
      });
      return {
        aceptada: false,
        confirmacionToken: null,
        motivoRechazo:
          'La persona rechazó la propuesta; quedó descartada y no se creará el ticket.',
        propuesta: { ...propuesta, estado: 'rechazada', resueltaEn: ahora },
      };
    }
    if (clasificacion === 'ambigua') {
      return this.rechazar(
        propuesta,
        'La respuesta de la persona no es una confirmación explícita; hay que pedirla de nuevo.',
        contexto,
        cuerpo,
      );
    }
    return this.emitir(propuesta, 'usuario-conversacion', texto, contexto, cuerpo);
  }

  /** Camino del frontend: el boton "Crear ticket" es en si mismo la accion explicita (HU-17). */
  async porAccionExplicita(
    propuestaId: string,
    contexto: ContextoOperacion,
  ): Promise<ResultadoConfirmacion> {
    const propuesta = await this.propuestaConfirmable(propuestaId, contexto);
    return this.emitir(propuesta, 'usuario-interfaz', null, contexto, {
      propuestaId,
      confirmacionExplicita: true,
    });
  }

  private async propuestaConfirmable(
    propuestaId: string,
    contexto: ContextoOperacion,
  ): Promise<Propuesta> {
    const propuesta = await this.repositorio.obtenerPropuesta(propuestaId);
    const fallo = this.motivoNoConfirmable(propuesta, propuestaId);
    if (fallo !== null) {
      await this.auditoria.registrar({
        ...contexto,
        accion: 'ticket.confirm',
        recurso: propuestaId,
        resultado: 'RECHAZADO',
        motivo: fallo.message,
        cuerpo: { propuestaId },
      });
      throw fallo;
    }
    return propuesta as Propuesta;
  }

  private motivoNoConfirmable(
    propuesta: Propuesta | null,
    propuestaId: string,
  ): ErrorTickets | null {
    if (propuesta === null) {
      return new ErrorTickets('RECURSO_NO_ENCONTRADO', 'La propuesta no existe.', { propuestaId });
    }
    if (propuesta.estado !== 'pendiente') {
      return new ErrorTickets(
        'PROPUESTA_RESUELTA',
        `La propuesta ya fue ${propuesta.estado}; no se puede volver a confirmar.`,
        { propuestaId, estado: propuesta.estado },
      );
    }
    if (propuesta.expiraEn.getTime() <= this.reloj.ahora().getTime()) {
      return new ErrorTickets('PROPUESTA_EXPIRADA', 'La propuesta venció; hay que preparar otra.', {
        propuestaId,
      });
    }
    if (propuesta.camposFaltantes.length > 0) {
      return new ErrorTickets(
        'PROPUESTA_INCOMPLETA',
        `Faltan datos en la propuesta: ${propuesta.camposFaltantes.join(', ')}.`,
        { propuestaId },
      );
    }
    return null;
  }

  private async emitir(
    propuesta: Propuesta,
    via: Confirmacion['via'],
    texto: string | null,
    contexto: ContextoOperacion,
    cuerpo: unknown,
  ): Promise<ResultadoConfirmacion> {
    const token = randomBytes(24).toString('base64url');
    await this.repositorio.guardarConfirmacion({
      propuestaId: propuesta.id,
      tokenHash: huellaToken(token),
      via,
      texto,
      confirmadaEn: this.reloj.ahora(),
      expiraEn: propuesta.expiraEn,
    });
    await this.auditoria.registrar({
      ...contexto,
      accion: 'ticket.confirm',
      recurso: propuesta.id,
      resultado: 'OK',
      cuerpo,
    });
    return { aceptada: true, confirmacionToken: token, motivoRechazo: null, propuesta };
  }

  private async rechazar(
    propuesta: Propuesta,
    motivo: string,
    contexto: ContextoOperacion,
    cuerpo: unknown,
  ): Promise<ResultadoConfirmacion> {
    await this.auditoria.registrar({
      ...contexto,
      accion: 'ticket.confirm',
      recurso: propuesta.id,
      resultado: 'RECHAZADO',
      motivo,
      cuerpo,
    });
    return { aceptada: false, confirmacionToken: null, motivoRechazo: motivo, propuesta };
  }
}
