import { Test } from '@nestjs/testing';
import { AgentCardController } from './agent-card.controller';

describe('AgentCardController (b3-a2a-conocimiento, HU-29)', () => {
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
    expect(card.name).toContain('Knowledge Agent');
  });

  it('debe declarar la habilidad knowledge_lookup con tags de politicas', () => {
    const card = controller.obtenerAgentCard();

    expect(card.skills).toHaveLength(1);
    const skill = card.skills[0];
    expect(skill.id).toBe('knowledge_lookup');
    expect(skill.tags).toContain('politicas');
    expect(skill.tags).toContain('conocimiento');
    expect(skill.outputModes).toContain('application/json');
  });

  it('debe construir la URL base con A2A_SELF_URL o el puerto por defecto', () => {
    const card = controller.obtenerAgentCard();
    expect(card.url).toMatch(/\/a2a$/);
  });
});
