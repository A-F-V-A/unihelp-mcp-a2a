import { Test } from '@nestjs/testing';
import { IDENTIDAD } from './identidad';
import { SaludController } from './salud.controller';
import { SaludService } from './salud.service';

describe('SaludController (b2-multiagente-local)', () => {
  let controller: SaludController;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [SaludController],
      providers: [SaludService],
    }).compile();

    controller = modulo.get(SaludController);
  });

  it('declara la arquitectura B2 y el servicio b2-multiagente-local', () => {
    const salud = controller.consultar();

    expect(salud.estado).toBe('ok');
    expect(salud.arquitectura).toBe('B2');
    expect(salud.servicio).toBe('b2-multiagente-local');
    expect(salud.protocolo).toBe(IDENTIDAD.protocolo);
  });

  it('reporta marca de tiempo en ISO 8601', () => {
    expect(Number.isNaN(Date.parse(controller.consultar().marcaTiempo))).toBe(false);
  });
});
