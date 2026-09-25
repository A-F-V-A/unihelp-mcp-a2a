import type { AgentCardDto } from '@unihelp/contratos';
import { RUTA_A2A } from '@unihelp/contratos';
import type { RolMultiagente } from '../roles';

const PROVEEDOR = {
  organization: 'Universidad del Quindío — Programa de Ingeniería de Sistemas y Computación',
  url: 'https://github.com/A-F-V-A/unihelp-mcp-a2a',
} as const;

/**
 * Las tres Agent Cards de docs/03 (2.1 a 2.3), servidas en
 * `/.well-known/agent-card.json` por cada servicio de B3 (HU-29). Viven aqui y
 * no en cada app porque el orquestador resuelve al especialista por
 * `skills[].id` y esos identificadores son los mismos que las habilidades que
 * ve su modelo: una sola fuente evita que se separen.
 *
 * `streaming` y `stateTransitionHistory` van en `false`: solo se implementa
 * `message/send` y la historia de estados vive en la traza, no en `tasks/get`.
 */
export function tarjetaAgente(rol: RolMultiagente, urlBase: string): AgentCardDto {
  const comun = {
    protocolVersion: '1.0',
    url: `${urlBase.replace(/\/+$/, '')}${RUTA_A2A}`,
    preferredTransport: 'JSONRPC' as const,
    version: '1.0.0',
    provider: PROVEEDOR,
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
  };
  switch (rol) {
    case 'conocimiento':
      return {
        ...comun,
        name: 'UniHelp Knowledge Agent',
        description:
          'Recupera y resume la política, procedimiento o guía institucional aplicable a una solicitud sobre servicios digitales universitarios. No ejecuta acciones de escritura.',
        skills: [
          {
            id: 'knowledge_lookup',
            name: 'Consulta de política institucional',
            description:
              'Dada una consulta y un servicio, identifica la política aplicable y devuelve las políticas con código, versión y extracto literal, un resumen y si no encontró nada.',
            tags: ['politicas', 'procedimientos', 'conocimiento'],
            examples: [
              '¿Cuál es el plazo para solicitar la reactivación del correo institucional?',
              '¿Qué requisitos hay para cancelar una asignatura fuera de fecha?',
            ],
            inputModes: ['application/json'],
            outputModes: ['application/json'],
          },
        ],
      };
    case 'diagnostico':
      return {
        ...comun,
        name: 'UniHelp Diagnosis Agent',
        description:
          'Interpreta síntomas reportados sobre servicios digitales, consulta su estado operativo y determina impacto, alcance y prioridad sugerida. No crea tickets.',
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
            inputModes: ['application/json'],
            outputModes: ['application/json'],
          },
        ],
      };
    case 'orquestador':
      return {
        ...comun,
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain', 'application/json'],
        name: 'UniHelp Triage Orchestrator',
        description:
          'Punto de entrada del triaje. Clasifica la solicitud, delega en los agentes especialistas mediante A2A, solicita confirmación explícita al usuario y crea el ticket simulado únicamente tras esa confirmación.',
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
            inputModes: ['text/plain'],
            outputModes: ['text/plain', 'application/json'],
          },
        ],
      };
  }
}
