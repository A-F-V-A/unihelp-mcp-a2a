import { Test } from '@nestjs/testing';
import { IDENTIDAD } from './identidad';
import { SaludController } from './salud.controller';
import { SaludService } from './salud.service';

describe('SaludController (b3-a2a-diagnostico)', () => {
  let controller: SaludController;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [SaludController],
      providers: [SaludService],
    }).compile();

    controller = modulo.get(SaludController);
  });

  it('declara la arquitectura B3 y el servicio b3-a2a-diagnostico', () => {
    const salud = controller.consultar();

    expect(salud.estado).toBe('ok');
    expect(salud.arquitectura).toBe('B3');
    expect(salud.servicio).toBe('b3-a2a-diagnostico');
    expect(salud.protocolo).toBe(IDENTIDAD.protocolo);
  });

  it('reporta marca de tiempo en ISO 8601', () => {
    expect(Number.isNaN(Date.parse(controller.consultar().marcaTiempo))).toBe(false);
  });
});
