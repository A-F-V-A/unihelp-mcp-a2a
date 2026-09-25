import { Test } from '@nestjs/testing';
import { AgentCardController } from './agent-card.controller';

describe('AgentCardController (b3-a2a-orquestador, HU-29)', () => {
  let controller: AgentCardController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AgentCardController],
    }).compile();

    controller = moduleRef.get<AgentCardController>(AgentCardController);
  });

  it('debe exponer la Agent Card del orquestador con especificacion A2A v1.0', () => {
    const card = controller.obtenerAgentCard();

    expect(card.protocolVersion).toBe('1.0');
    expect(card.preferredTransport).toBe('JSONRPC');
    expect(card.version).toBe('1.0.0');
    expect(card.name).toContain('Orchestrator');
  });

  it('debe declarar la habilidad incident_triage', () => {
    const card = controller.obtenerAgentCard();

    expect(card.skills).toHaveLength(1);
    const skill = card.skills[0];
    expect(skill.id).toBe('incident_triage');
    expect(skill.tags).toContain('triaje');
  });

  it('debe construir la URL base con A2A_SELF_URL o el puerto por defecto', () => {
    const card = controller.obtenerAgentCard();
    expect(card.url).toMatch(/\/a2a$/);
  });
});
