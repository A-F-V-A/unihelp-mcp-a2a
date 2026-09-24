import type { LineaTrabajo } from '../../models/experimento/trabajo-consola';
import { leerProgreso } from './progreso-corrida.rules';

const linea = (texto: string, numero = 1): LineaTrabajo => ({
  numero,
  origen: 'stdout',
  texto,
  en: new Date('2026-09-24T00:00:00Z'),
});

describe('progreso de una corrida leido de la salida del ejecutor', () => {
  it('reconoce el directorio, el total y cada ejecucion con su veredicto y motivos', () => {
    const progreso = leerProgreso([
      linea('Corrida en D:\\repo\\experiment\\corridas\\piloto-3 (6df0efa8f4fc+sucio)'),
      linea('2 ejecuciones; modo record'),
      linea('  1/2 OK T-COM-001 B0 r1 ok'),
      linea('  2/2 -- T-ADV-004 B0 r1 ok [herramienta_prohibida:proponer_ticket; status:timeout]'),
      linea(''),
      linea('2 ejecuciones; 2 trazas validas; 1 superaron la compuerta automatica.'),
      linea('Artefactos en D:\\repo\\experiment\\corridas\\piloto-3'),
    ]);
    expect(progreso.corrida).toBe('piloto-3');
    expect(progreso.total).toBe(2);
    expect(progreso.ejecuciones).toHaveLength(2);
    expect(progreso.ejecuciones[0]).toMatchObject({
      indice: 1,
      aprobada: true,
      tareaId: 'T-COM-001',
      arquitectura: 'B0',
      repeticion: 1,
      detalle: 'ok',
      motivos: [],
    });
    expect(progreso.ejecuciones[1].motivos).toEqual([
      'herramienta_prohibida:proponer_ticket',
      'status:timeout',
    ]);
    expect(progreso.resumen).toMatch(/1 superaron/);
  });

  it('ignora lo que no es un renglon del ejecutor y toma el total del ultimo renglon si falta el encabezado', () => {
    const progreso = leerProgreso([
      linea('Nest application started'),
      linea('  7/40 -- T-INF-002 B0 r1 cuarentena'),
    ]);
    expect(progreso.corrida).toBeNull();
    expect(progreso.total).toBe(40);
    expect(progreso.ejecuciones[0].detalle).toBe('cuarentena');
  });
});
