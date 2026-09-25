import { Controller, Get } from '@nestjs/common';
import type { AgentCardDto } from '@unihelp/contratos';
import { RUTA_AGENT_CARD } from '@unihelp/contratos';
import { tarjetaAgente } from '@unihelp/multiagente-nucleo';
import { PUERTO_POR_DEFECTO } from '../salud/identidad';

/**
 * Expone la Agent Card del especialista de conocimiento en `/.well-known/agent-card.json`
 * (HU-29). `A2A_SELF_URL` es la URL con la que el orquestador lo alcanza (en
 * Docker, el nombre del servicio); sin ella, la local.
 */
@Controller()
export class AgentCardController {
  @Get(RUTA_AGENT_CARD.slice(1))
  obtenerAgentCard(): AgentCardDto {
    const urlBase =
      process.env.A2A_SELF_URL ?? `http://localhost:${process.env.PORT ?? PUERTO_POR_DEFECTO}`;
    return tarjetaAgente('conocimiento', urlBase);
  }
}
