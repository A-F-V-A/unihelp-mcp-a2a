import { Inject, Injectable } from '@nestjs/common';
import { DEFINICIONES_HERRAMIENTAS, definicionDe } from '@unihelp/herramientas';
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';
import type { AdaptadorHerramienta } from './adaptadores/adaptador';
import { AdaptadorBuscarPolitica } from './adaptadores/buscar-politica.adaptador';
import { AdaptadorConfirmarPropuesta } from './adaptadores/confirmar-propuesta.adaptador';
import { AdaptadorConsultarEstadoServicio } from './adaptadores/consultar-estado-servicio.adaptador';
import { AdaptadorCrearTicketSimulado } from './adaptadores/crear-ticket-simulado.adaptador';
import { AdaptadorProponerTicket } from './adaptadores/proponer-ticket.adaptador';

/**
 * Lista FIJA de herramientas de B0: nombre, descripcion y esquemas salen del
 * contrato compartido de `@unihelp/herramientas`, el mismo que publicara B1.
 * Agregar una herramienta obliga a tocar esta clase y recompilar: ese esfuerzo
 * es un dato de M6.1 a M6.5, no un defecto (HU-27).
 */
@Injectable()
export class RegistroCapacidades {
  private readonly adaptadores: ReadonlyMap<string, AdaptadorHerramienta>;
  /** Definiciones en el formato de function calling del proveedor. */
  readonly definiciones: readonly ChatCompletionFunctionTool[];

  constructor(
    @Inject(AdaptadorBuscarPolitica) buscar: AdaptadorBuscarPolitica,
    @Inject(AdaptadorConsultarEstadoServicio) estado: AdaptadorConsultarEstadoServicio,
    @Inject(AdaptadorProponerTicket) proponer: AdaptadorProponerTicket,
    @Inject(AdaptadorConfirmarPropuesta) confirmar: AdaptadorConfirmarPropuesta,
    @Inject(AdaptadorCrearTicketSimulado) crear: AdaptadorCrearTicketSimulado,
  ) {
    this.adaptadores = new Map(
      [buscar, estado, proponer, confirmar, crear].map((a) => [a.nombre, a] as const),
    );
    this.definiciones = DEFINICIONES_HERRAMIENTAS.map((d) => ({
      type: 'function',
      function: {
        name: d.nombre,
        description: d.descripcion,
        parameters: d.esquemaEntrada as Record<string, unknown>,
      },
    }));
  }

  adaptador(nombre: string): AdaptadorHerramienta | undefined {
    return this.adaptadores.get(nombre);
  }

  tipo(nombre: string): 'lectura' | 'escritura' | undefined {
    return definicionDe(nombre)?.tipo;
  }
}
