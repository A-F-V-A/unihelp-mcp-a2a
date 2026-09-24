import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import type { PropuestaTicketDto, TicketDto } from '@unihelp/contratos';
import {
  ConfirmarPropuestaUseCase,
  ConsultarPropuestasUseCase,
  CrearTicketUseCase,
  type Propuesta,
} from '@unihelp/tickets';
import { RepositorioConversaciones } from '../conversacion/repositorio-conversaciones';
import { aPropuestaTicketDto, aTicketDto } from '../conversacion/mapeo-dto';
import { CatalogoServicios } from '../catalogo/catalogo-servicios';
import { ErrorApi } from '../http/error-api';

/** Actor de auditoria de las acciones que la persona hace con los botones del frontend. */
const ACTOR_INTERFAZ = 'usuario-interfaz';

/**
 * Rutas de tickets del frontend (decision 13). La tarjeta de propuesta la arma
 * el agente con `proponer_ticket`; aqui solo se lee, se confirma con el boton o
 * se rechaza. Confirmar pasa por los MISMOS casos de uso que la herramienta:
 * token emitido por `ConfirmarPropuestaUseCase` y validado por `CrearTicketUseCase`.
 */
@Controller('tickets/propuestas')
export class TicketsController {
  constructor(
    @Inject(ConsultarPropuestasUseCase) private readonly propuestas: ConsultarPropuestasUseCase,
    @Inject(ConfirmarPropuestaUseCase) private readonly confirmar: ConfirmarPropuestaUseCase,
    @Inject(CrearTicketUseCase) private readonly crear: CrearTicketUseCase,
    @Inject(RepositorioConversaciones) private readonly conversaciones: RepositorioConversaciones,
    @Inject(CatalogoServicios) private readonly catalogo: CatalogoServicios,
  ) {}

  /** `POST /api/tickets/propuestas`: la propuesta pendiente que preparo el agente. No crea nada. */
  @Post()
  @HttpCode(200)
  async solicitar(@Body() cuerpo: unknown): Promise<PropuestaTicketDto> {
    const conversacionId = (cuerpo as Record<string, unknown> | null)?.['conversacionId'];
    if (typeof conversacionId !== 'string') {
      throw new ErrorApi('validacion', 'Falta el campo conversacionId.', {
        campo: 'conversacionId',
      });
    }
    const propuesta = await this.propuestas.pendienteDe(conversacionId);
    if (propuesta === null) {
      throw new ErrorApi(
        'validacion',
        'No hay un diagnóstico en la conversación que justifique proponer un ticket.',
        { conversacionId },
      );
    }
    return this.aDto(propuesta);
  }

  /** `POST .../:id/confirmacion`: UNICA ruta del frontend que crea un ticket (HU-17). */
  @Post(':id/confirmacion')
  @HttpCode(200)
  async confirmarPropuesta(@Param('id') id: string, @Body() cuerpo: unknown): Promise<TicketDto> {
    if ((cuerpo as Record<string, unknown> | null)?.['confirmacionExplicita'] !== true) {
      throw new ErrorApi(
        'validacion',
        'Para crear el ticket se requiere confirmacionExplicita: true.',
        { campo: 'confirmacionExplicita' },
      );
    }
    const contexto = { traceId: await this.traceDe(id), actor: ACTOR_INTERFAZ };
    const { confirmacionToken } = await this.confirmar.porAccionExplicita(id, contexto);
    const { ticket } = await this.crear.ejecutar(id, confirmacionToken ?? '', contexto);
    const servicio = await this.catalogo.servicio(ticket.servicio);
    if (servicio === undefined) {
      throw new ErrorApi('interno', 'El servicio del ticket no existe en el catálogo.');
    }
    return aTicketDto(ticket, servicio);
  }

  /** `POST .../:id/rechazo`: la propuesta queda descartada (HU-15). */
  @Post(':id/rechazo')
  @HttpCode(200)
  async rechazar(@Param('id') id: string): Promise<PropuestaTicketDto> {
    const contexto = { traceId: await this.traceDe(id), actor: ACTOR_INTERFAZ };
    return this.aDto(await this.propuestas.rechazar(id, contexto));
  }

  /** El trace de la conversacion, para que la auditoria de los botones quede junto a la del agente. */
  private async traceDe(propuestaId: string): Promise<string> {
    const propuesta = await this.propuestas.obtener(propuestaId);
    if (propuesta === null) {
      throw new ErrorApi('no-encontrado', 'La propuesta no existe.', { propuestaId });
    }
    return this.conversaciones.obtener(propuesta.conversacionId)?.traceId ?? propuesta.traceId;
  }

  private async aDto(propuesta: Propuesta): Promise<PropuestaTicketDto> {
    const servicio = await this.catalogo.servicio(propuesta.servicio);
    if (servicio === undefined) {
      throw new ErrorApi('interno', 'El servicio de la propuesta no existe en el catálogo.');
    }
    return aPropuestaTicketDto(propuesta, servicio);
  }
}
