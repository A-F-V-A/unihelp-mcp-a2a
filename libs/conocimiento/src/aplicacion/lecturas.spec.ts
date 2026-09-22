import * as semillaJson from '../../seeds/conocimiento.semilla.json';
import { PoliticaNoEncontradaError } from '../dominio/errores';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { construirEstadoConocimiento, validarSemilla } from '../dominio/reglas/semilla.rules';
import { ListarServiciosUseCase } from './listar-servicios.use-case';
import { ObtenerPoliticaUseCase } from './obtener-politica.use-case';

const semilla = validarSemilla((semillaJson as { default?: unknown }).default ?? semillaJson);
const estado = construirEstadoConocimiento(semilla);

function repositorio(): ConocimientoRepository {
  return {
    buscarPoliticasVigentes: jest.fn(),
    obtenerComponentesDeServicio: jest.fn(),
    obtenerPoliticasDeCategoria: jest.fn(),
    sembrarSiVacia: jest.fn(),
    restablecer: jest.fn(),
    leerEstado: jest.fn().mockResolvedValue(estado),
  };
}

describe('ObtenerPoliticaUseCase', () => {
  it('sin version devuelve la marcada como vigente, con extractos en orden de ordinal', async () => {
    const resultado = await new ObtenerPoliticaUseCase(repositorio()).ejecutar('POL-AV-002');
    expect(resultado.version.vigente).toBe(true);
    const ordinales = resultado.extractos.map((e) => e.ordinal);
    expect(ordinales).toEqual([...ordinales].sort((a, b) => a - b));
    expect(resultado.servicios).toContain('aula_virtual');
  });

  it('rechaza una politica o una version inexistentes', async () => {
    const caso = new ObtenerPoliticaUseCase(repositorio());
    await expect(caso.ejecutar('POL-XX-999')).rejects.toBeInstanceOf(PoliticaNoEncontradaError);
    await expect(caso.ejecutar('POL-AV-002', '99.9')).rejects.toBeInstanceOf(
      PoliticaNoEncontradaError,
    );
  });
});

describe('ListarServiciosUseCase', () => {
  it('devuelve los servicios ordenados por codigo', async () => {
    const servicios = await new ListarServiciosUseCase(repositorio()).ejecutar();
    expect(servicios.map((s) => s.codigo)).toEqual([
      'aula_virtual',
      'autenticacion',
      'correo_institucional',
      'matricula',
    ]);
  });
});
