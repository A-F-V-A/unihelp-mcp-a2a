import { TestBed } from '@angular/core/testing';
import type {
  Calificacion,
  ItemRevision,
  MarcasRevision,
  ProgresoRevisor,
  RolRevisor,
  VeredictoRevision,
} from '../../domain/models/experimento/revision-humana';
import type { RevisionHumanaRepository } from '../../domain/ports/revision-humana.repository';
import { REVISION_HUMANA_REPOSITORY } from '../di/tokens';
import { RevisionStore } from './revision.store';

const item = (id: string): ItemRevision => ({
  id,
  tarea: 'T-INF-007',
  dialogo: [],
  respuestaFinal: 'Respuesta.',
  puntosClave: ['Punto uno.', 'Punto dos.'],
  prohibiciones: ['Prohibición.'],
  informacionRecuperada: [],
});

class RepositorioFalso implements RevisionHumanaRepository {
  revisor: string | null = null;
  previas: Calificacion[] = [];
  enviadas: { itemId: string; veredicto: VeredictoRevision; marcas: MarcasRevision }[] = [];

  async muestra() {
    return { version: 'prueba', items: [item('R-001'), item('R-002'), item('R-003')] };
  }

  async progreso(rol: RolRevisor): Promise<ProgresoRevisor> {
    return { rol, revisor: this.revisor, total: 3, calificaciones: this.previas };
  }

  async calificar(
    rol: RolRevisor,
    revisor: string,
    itemId: string,
    marcas: MarcasRevision,
    veredicto: VeredictoRevision,
    comentario: string | null,
  ): Promise<Calificacion> {
    this.enviadas.push({ itemId, veredicto, marcas });
    return { rol, revisor, itemId, ...marcas, veredicto, comentario, guardadaEn: new Date() };
  }

  async adjudicacion() {
    return {
      disponible: false,
      calificadasA: 0,
      calificadasB: 0,
      total: 3,
      acuerdos: 0,
      desacuerdos: [],
    };
  }

  async adjudicar(itemId: string, veredicto: VeredictoRevision, motivo: string) {
    return { itemId, veredicto, motivo, guardadaEn: new Date() };
  }
}

describe('RevisionStore', () => {
  let repositorio: RepositorioFalso;
  let store: RevisionStore;

  beforeEach(() => {
    repositorio = new RepositorioFalso();
    TestBed.configureTestingModule({
      providers: [{ provide: REVISION_HUMANA_REPOSITORY, useValue: repositorio }],
    });
    store = TestBed.inject(RevisionStore);
  });

  it('retoma en el primer item pendiente de esa persona', async () => {
    repositorio.revisor = 'Ana';
    repositorio.previas = [
      {
        rol: 'A',
        revisor: 'Ana',
        itemId: 'R-001',
        puntosCubiertos: [1, 2],
        prohibicionesVioladas: [],
        veredicto: 'aprobado',
        comentario: null,
        guardadaEn: new Date(),
      },
    ];
    await store.iniciar('A', 'Ana');
    expect(store.etapa()).toBe('calificando');
    expect(store.item()?.id).toBe('R-002');
    expect(store.calificadas()).toBe(1);
  });

  it('no deja entrar a otra persona en un rol ya tomado', async () => {
    repositorio.revisor = 'Ana';
    await store.iniciar('A', 'Beto');
    expect(store.etapa()).toBe('inicio');
    expect(store.error()).toContain('ya lo tomó Ana');
  });

  it('envia el veredicto que dicta la rubrica y avanza al siguiente pendiente', async () => {
    await store.iniciar('B', 'Beto');
    store.alternarPunto(1);
    expect(store.veredicto()).toBe('reprobado');
    store.alternarPunto(2);
    expect(store.veredicto()).toBe('aprobado');
    await store.guardarYSeguir();
    expect(repositorio.enviadas[0]).toEqual({
      itemId: 'R-001',
      veredicto: 'aprobado',
      marcas: { puntosCubiertos: [1, 2], prohibicionesVioladas: [] },
    });
    expect(store.item()?.id).toBe('R-002');
    expect(store.marcas()).toEqual({ puntosCubiertos: [], prohibicionesVioladas: [] });
  });

  it('termina cuando no quedan pendientes', async () => {
    await store.iniciar('A', 'Ana');
    for (let i = 0; i < 3; i++) {
      await store.guardarYSeguir();
    }
    expect(store.etapa()).toBe('terminado');
    expect(repositorio.enviadas.map((e) => e.veredicto)).toEqual([
      'reprobado',
      'reprobado',
      'reprobado',
    ]);
  });
});
