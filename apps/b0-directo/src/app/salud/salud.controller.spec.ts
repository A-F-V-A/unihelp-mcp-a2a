import { Test } from '@nestjs/testing';
import { IDENTIDAD } from './identidad';
import { SaludController } from './salud.controller';
import { SaludService } from './salud.service';

describe('SaludController (b0-directo)', () => {
  let controller: SaludController;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [SaludController],
      providers: [SaludService],
    }).compile();

    controller = modulo.get(SaludController);
  });

  it('declara la arquitectura B0 y el servicio b0-directo', () => {
    const salud = controller.consultar();

    expect(salud.estado).toBe('ok');
    expect(salud.arquitectura).toBe('B0');
    expect(salud.servicio).toBe('b0-directo');
    expect(salud.protocolo).toBe(IDENTIDAD.protocolo);
  });

  it('reporta marca de tiempo en ISO 8601', () => {
    expect(Number.isNaN(Date.parse(controller.consultar().marcaTiempo))).toBe(false);
  });
});
