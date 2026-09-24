import { Controller, Get } from '@nestjs/common';
import type { AgentCardDto } from '@unihelp/contratos';
import { RUTA_A2A, RUTA_AGENT_CARD } from '@unihelp/contratos';
import { PUERTO_POR_DEFECTO } from '../salud/identidad';

/**
 * Expone la Agent Card de b3-a2a-conocimiento en `/.well-known/agent-card.json` (HU-29).
 * Permite al orquestador descubrir las habilidades de consulta de politicas institucionales.
 */
@Controller()
export class AgentCardController {
  @Get(RUTA_AGENT_CARD.slice(1))
  obtenerAgentCard(): AgentCardDto {
    const baseUrl =
      process.env.A2A_SELF_URL ?? `http://localhost:${process.env.PORT ?? PUERTO_POR_DEFECTO}`;

    return {
      protocolVersion: '1.0',
      name: 'UniHelp Knowledge Agent',
      description:
        'Recupera y resume la política, procedimiento o guía institucional aplicable a una solicitud sobre servicios digitales universitarios. No ejecuta acciones de escritura.',
      url: `${baseUrl}${RUTA_A2A}`,
      preferredTransport: 'JSONRPC',
      version: '1.0.0',
      provider: {
        organization: 'Universidad del Quindío — Programa de Ingeniería de Sistemas y Computación',
        url: 'https://github.com/<org>/unihelp-interoperability-study',
      },
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain', 'application/json'],
      skills: [
        {
          id: 'knowledge_lookup',
          name: 'Consulta de política institucional',
          description:
            'Dada una solicitud en lenguaje natural, identifica la política aplicable y devuelve un resumen con las fuentes citadas (código y versión).',
          tags: ['politicas', 'procedimientos', 'conocimiento'],
          examples: [
            '¿Cuál es el plazo para solicitar la reactivación del correo institucional?',
            '¿Qué requisitos hay para cancelar una asignatura fuera de fecha?',
          ],
          inputModes: ['text/plain'],
          outputModes: ['application/json'],
        },
      ],
    };
  }
}
