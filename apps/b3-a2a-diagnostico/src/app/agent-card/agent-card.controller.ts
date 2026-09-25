import { Controller, Get } from '@nestjs/common';
import type { AgentCardDto } from '@unihelp/contratos';
import { RUTA_A2A, RUTA_AGENT_CARD } from '@unihelp/contratos';
import { PUERTO_POR_DEFECTO } from '../salud/identidad';

/**
 * Expone la Agent Card de b3-a2a-diagnostico en `/.well-known/agent-card.json` (HU-29).
 * Permite al orquestador descubrir las habilidades de evaluacion de incidentes.
 */
@Controller()
export class AgentCardController {
  @Get(RUTA_AGENT_CARD.slice(1))
  obtenerAgentCard(): AgentCardDto {
    const baseUrl =
      process.env.A2A_SELF_URL ?? `http://localhost:${process.env.PORT ?? PUERTO_POR_DEFECTO}`;

    return {
      protocolVersion: '1.0',
      name: 'UniHelp Diagnosis Agent',
      description:
        'Interpreta síntomas reportados sobre servicios digitales, consulta su estado operativo y determina impacto, alcance y prioridad sugerida. No crea tickets.',
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
          id: 'incident_diagnosis',
          name: 'Diagnóstico de incidente',
          description:
            'Relaciona los síntomas descritos con el estado y los componentes afectados del servicio, y devuelve un diagnóstico estructurado con prioridad calculada según la tabla institucional.',
          tags: ['diagnostico', 'incidentes', 'estado'],
          examples: [
            'No puedo subir archivos al aula virtual desde ayer',
            'El correo institucional rebota todos los mensajes externos',
          ],
          outputModes: ['application/json'],
        },
      ],
    };
  }
}
