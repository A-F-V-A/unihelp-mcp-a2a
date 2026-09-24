import { Controller, Get } from '@nestjs/common';
import type { AgentCardDto } from '@unihelp/contratos';
import { RUTA_A2A, RUTA_AGENT_CARD } from '@unihelp/contratos';
import { PUERTO_POR_DEFECTO } from '../salud/identidad';

/**
 * Expone la Agent Card de b3-a2a-orquestador en `/.well-known/agent-card.json` (HU-29).
 * Permite a clientes externos y al runner descubrir las habilidades del orquestador.
 */
@Controller()
export class AgentCardController {
  @Get(RUTA_AGENT_CARD.slice(1))
  obtenerAgentCard(): AgentCardDto {
    const baseUrl =
      process.env.A2A_SELF_URL ?? `http://localhost:${process.env.PORT ?? PUERTO_POR_DEFECTO}`;

    return {
      protocolVersion: '1.0',
      name: 'UniHelp Triage Orchestrator',
      description:
        'Punto de entrada del triaje. Clasifica la solicitud, delega en los agentes especialistas mediante A2A, solicita confirmación explícita al usuario y crea el ticket simulado únicamente tras esa confirmación.',
      url: `${baseUrl}${RUTA_A2A}`,
      preferredTransport: 'JSONRPC',
      version: '1.0.0',
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['application/json'],
      skills: [
        {
          id: 'incident_triage',
          name: 'Triaje de incidentes de servicios digitales',
          description:
            'Resuelve solicitudes informativas, de diagnóstico o compuestas sobre aula virtual, correo institucional, autenticación y matrícula.',
          tags: ['triaje', 'soporte', 'universidad'],
          examples: [
            'El aula virtual va lentísima y necesito saber si puedo pedir prórroga para la entrega',
            '¿Cómo recupero mi contraseña institucional?',
          ],
        },
      ],
    };
  }
}
