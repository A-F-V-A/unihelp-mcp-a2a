import { KnowledgeLookupService } from './knowledge-lookup.service';
import type { CapacidadesMcpConocimiento } from '../capacidades-mcp/capacidades-mcp-conocimiento';

describe('KnowledgeLookupService (HU-05, HU-30)', () => {
  let servicio: KnowledgeLookupService;
  let mockCapacidadesMcp: {
    buscarPolitica: jest.Mock;
  };

  beforeEach(() => {
    mockCapacidadesMcp = {
      buscarPolitica: jest.fn(),
    };
    servicio = new KnowledgeLookupService(
      mockCapacidadesMcp as unknown as CapacidadesMcpConocimiento,
    );
  });

  it('debe devolver directamente el artefacto cuando la primera busqueda tiene resultados', async () => {
    mockCapacidadesMcp.buscarPolitica.mockResolvedValueOnce({
      artefacto: {
        politicas: [
          {
            codigo: 'POL-CI-001',
            titulo: 'Recuperación de acceso al correo institucional',
            version: '1.1',
            extracto: 'Extracto de prueba',
            relevancia: 0.9,
          },
        ],
        resumen: 'Según la política POL-CI-001...',
        confianza: 'alta',
        sin_resultados: false,
      },
      durMs: 12,
      rttMs: 15,
    });

    const res = await servicio.ejecutarLookup('recuperar correo', 'trace-1');

    expect(res.artefacto.artifactId).toBe('politica_aplicable');
    const parte = res.artefacto.parts[0];
    expect(parte.kind).toBe('data');
    if (parte.kind === 'data') {
      expect(parte.data.sin_resultados).toBe(false);
      expect(parte.data.politicas).toHaveLength(1);
    }
    expect(mockCapacidadesMcp.buscarPolitica).toHaveBeenCalledTimes(1);
  });

  it('debe reintentar con terminos clave si la primera busqueda con lenguaje natural arroja sin resultados', async () => {
    // Primer intento sin resultados por dilucion de formula interrogativa
    mockCapacidadesMcp.buscarPolitica.mockResolvedValueOnce({
      artefacto: {
        politicas: [],
        resumen: 'No se encontraron políticas.',
        confianza: 'baja',
        sin_resultados: true,
      },
      durMs: 10,
      rttMs: 12,
    });

    // Segundo intento con terminos clave que si encuentra
    mockCapacidadesMcp.buscarPolitica.mockResolvedValueOnce({
      artefacto: {
        politicas: [
          {
            codigo: 'POL-CI-003',
            titulo: 'Reactivación por inactividad',
            version: '1.1',
            extracto: 'La reactivación tarda 5 días hábiles.',
            relevancia: 0.85,
          },
        ],
        resumen: 'Según la política POL-CI-003: La reactivación tarda 5 días hábiles.',
        confianza: 'alta',
        sin_resultados: false,
      },
      durMs: 8,
      rttMs: 10,
    });

    const res = await servicio.ejecutarLookup(
      '¿Cuál es la política institucional para reactivar el correo electrónico y qué plazo tengo?',
      'trace-2',
    );

    expect(mockCapacidadesMcp.buscarPolitica).toHaveBeenCalledTimes(2);
    expect(mockCapacidadesMcp.buscarPolitica).toHaveBeenNthCalledWith(
      2,
      'reactivar correo electronico',
      'trace-2',
    );
    const parte = res.artefacto.parts[0];
    expect(parte.kind).toBe('data');
    if (parte.kind === 'data') {
      expect(parte.data.sin_resultados).toBe(false);
      expect(parte.data.politicas[0].codigo).toBe('POL-CI-003');
    }
  });
});
