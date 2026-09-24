import { Inject, Injectable } from '@nestjs/common';
import type { AccionSugeridaDto, BloqueRespuestaDto, ClasificacionDto } from '@unihelp/contratos';
import type { ComponentesDeServicio, ResultadoBusquedaPoliticas } from '@unihelp/conocimiento';
import { MAXIMO_POLITICAS_POR_RESPUESTA, type TipoClasificacion } from '@unihelp/dominio';
import type { ClasificacionObjetoFinal, ObjetoFinal } from '@unihelp/herramientas';
import type { Ticket } from '@unihelp/tickets';
import type { LlamadaDelTurno } from '../agente/bucle-agente';
import { CatalogoServicios } from '../catalogo/catalogo-servicios';
import { aCitaPoliticaDto, aEstadoServicioDto, aTicketDto } from './mapeo-dto';

/** `adversarial` no existe en `TIPOS_CLASIFICACION`: el contrato recibe `null` (DP-03). */
const CLASIFICACION_CONTRATO: Readonly<Record<ClasificacionObjetoFinal, TipoClasificacion | null>> =
  {
    informativa: 'informativa',
    diagnostico: 'diagnostico',
    compuesta: 'compuesta',
    fuera_de_alcance: 'fuera-de-alcance',
    adversarial: null,
  };

export interface RespuestaEnsamblada {
  readonly clasificacion: ClasificacionDto | null;
  readonly bloques: readonly BloqueRespuestaDto[];
  readonly accionSugerida: AccionSugeridaDto;
}

/**
 * Convierte el texto final y los resultados de las herramientas de UN turno en
 * los bloques de `MensajeAsistenteDto`. Solo da forma a lo que el modelo y las
 * herramientas ya produjeron: no decide nada que entre en una metrica.
 */
@Injectable()
export class EnsambladorRespuesta {
  constructor(@Inject(CatalogoServicios) private readonly catalogo: CatalogoServicios) {}

  async ensamblar(
    texto: string,
    objeto: ObjetoFinal | null,
    llamadas: readonly LlamadaDelTurno[],
  ): Promise<RespuestaEnsamblada> {
    const bloques: BloqueRespuestaDto[] = [];
    if (texto.trim() !== '') {
      bloques.push({ tipo: 'texto', texto: texto.trim() });
    }

    const politicas = await this.politicasCitadas(texto, objeto, llamadas);
    if (politicas.length > 0) {
      bloques.push({ tipo: 'politicas', politicas });
    }

    for (const llamada of exitosas(llamadas, 'consultar_estado_servicio')) {
      const estado = aEstadoServicioDto(llamada.estructurado as ComponentesDeServicio);
      bloques.push(
        estado.estado === 'mantenimiento'
          ? { tipo: 'aviso-mantenimiento', estado }
          : { tipo: 'estado-servicio', estado },
      );
    }

    const creados = exitosas(llamadas, 'crear_ticket_simulado');
    for (const llamada of creados) {
      const { ticket } = llamada.estructurado as { ticket: Ticket };
      const servicio = await this.catalogo.servicio(ticket.servicio);
      if (servicio) {
        bloques.push({ tipo: 'ticket-creado', ticket: aTicketDto(ticket, servicio) });
      }
    }

    // Una propuesta del turno que sigue pendiente: el frontend la pide y muestra la tarjeta.
    const propuso = exitosas(llamadas, 'proponer_ticket').length > 0;
    const confirmoONego = exitosas(llamadas, 'confirmar_propuesta').length > 0;
    const accionSugerida: AccionSugeridaDto =
      propuso && creados.length === 0 && !confirmoONego ? 'proponer-ticket' : null;

    const tipo = objeto === null ? null : CLASIFICACION_CONTRATO[objeto.clasificacion];
    return {
      clasificacion:
        tipo === null || objeto === null ? null : { tipo, confianza: objeto.confianza },
      bloques,
      accionSugerida,
    };
  }

  private async politicasCitadas(
    texto: string,
    objeto: ObjetoFinal | null,
    llamadas: readonly LlamadaDelTurno[],
  ) {
    const recuperadas = exitosas(llamadas, 'buscar_politica').flatMap((l) => {
      const r = l.estructurado as ResultadoBusquedaPoliticas;
      return r.tipo === 'encontradas' ? r.politicas : [];
    });
    // Solo las que el agente cito; sin objeto final, las que nombra en el texto.
    const citadas = recuperadas.filter((p) =>
      objeto === null ? texto.includes(p.codigo) : objeto.politicas_citadas.includes(p.codigo),
    );
    const unicas = [...new Map(citadas.map((p) => [p.codigo, p])).values()].slice(
      0,
      MAXIMO_POLITICAS_POR_RESPUESTA,
    );
    const resultado = [];
    for (const politica of unicas) {
      const servicio = await this.catalogo.servicio(politica.servicios[0] ?? '');
      if (servicio) {
        resultado.push(aCitaPoliticaDto(politica, servicio.area));
      }
    }
    return resultado;
  }
}

function exitosas(
  llamadas: readonly LlamadaDelTurno[],
  nombre: string,
): readonly LlamadaDelTurno[] {
  return llamadas.filter((l) => l.ok && l.nombre === nombre);
}
