import { Test } from '@nestjs/testing';
import { AgentCardController } from './agent-card.controller';

describe('AgentCardController (b3-a2a-diagnostico, HU-29)', () => {
  let controller: AgentCardController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AgentCardController],
    }).compile();

    controller = moduleRef.get<AgentCardController>(AgentCardController);
  });

  it('debe exponer la Agent Card con especificacion A2A v1.0', () => {
    const card = controller.obtenerAgentCard();

    expect(card.protocolVersion).toBe('1.0');
    expect(card.preferredTransport).toBe('JSONRPC');
    expect(card.version).toBe('1.0.0');
    expect(card.name).toContain('Diagnosis Agent');
  });

  it('debe declarar la habilidad incident_diagnosis con tags de diagnostico', () => {
    const card = controller.obtenerAgentCard();

    expect(card.skills).toHaveLength(1);
    const skill = card.skills[0];
    expect(skill.id).toBe('incident_diagnosis');
    expect(skill.tags).toContain('diagnostico');
    expect(skill.tags).toContain('incidentes');
    expect(skill.outputModes).toContain('application/json');
  });

  it('debe construir la URL base con A2A_SELF_URL o el puerto por defecto', () => {
    const card = controller.obtenerAgentCard();
    expect(card.url).toMatch(/\/a2a$/);
  });
});
