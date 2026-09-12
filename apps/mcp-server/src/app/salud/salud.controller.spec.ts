import { Test } from '@nestjs/testing';
import { IDENTIDAD } from './identidad';
import { SaludController } from './salud.controller';
import { SaludService } from './salud.service';

describe('SaludController (mcp-server)', () => {
  let controller: SaludController;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [SaludController],
      providers: [SaludService],
    }).compile();

    controller = modulo.get(SaludController);
  });

  it('declara la arquitectura COMPARTIDO y el servicio mcp-server', () => {
    const salud = controller.consultar();

    expect(salud.estado).toBe('ok');
    expect(salud.arquitectura).toBe('COMPARTIDO');
    expect(salud.servicio).toBe('mcp-server');
    expect(salud.protocolo).toBe(IDENTIDAD.protocolo);
  });

  it('reporta marca de tiempo en ISO 8601', () => {
    expect(Number.isNaN(Date.parse(controller.consultar().marcaTiempo))).toBe(false);
  });
});
