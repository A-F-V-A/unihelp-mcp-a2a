import { Test } from '@nestjs/testing';
import { tmpdir } from 'node:os';
import { PersistidorTrazas } from './persistidor-trazas';
import { TrazasModule } from './trazas.module';
import { ValidadorTrazas } from './validador-trazas';

describe('TrazasModule', () => {
  it('expone el validador y un persistidor configurado para la corrida', async () => {
    const modulo = await Test.createTestingModule({
      imports: [TrazasModule.registrar({ directorioCorrida: tmpdir() })],
    }).compile();

    expect(modulo.get(ValidadorTrazas)).toBeInstanceOf(ValidadorTrazas);
    expect(modulo.get(PersistidorTrazas)).toBeInstanceOf(PersistidorTrazas);
  });
});
