import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EXPERIMENTO_REPOSITORY } from '../../application/di/tokens';
import { ErrorBackend } from '../../domain/errors/error-backend';
import { CONFIGURACION_APP } from '../../nucleo/configuracion';
import { provideDataLayer } from '../provide-data-layer';

/** Deja que `firstValueFrom` se suscriba antes de buscar la peticion. */
const microtareas = () => new Promise((resolver) => setTimeout(resolver, 0));

describe('EstaticosExperimentoRepository: archivos estaticos del experimento', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIGURACION_APP, useValue: { backendUrl: 'http://backend:3000', consolaUrl: 'http://consola:3030' } },
        provideDataLayer(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee el catalogo de corridas del mismo origen, no del backend', async () => {
    const promesa = TestBed.inject(EXPERIMENTO_REPOSITORY).listarCorridas();
    await microtareas();
    const peticion = http.expectOne('datos-experimento/corridas/indice.json');
    expect(peticion.request.method).toBe('GET');
    peticion.flush(
      JSON.stringify({
        generado_en: '2026-09-23T00:00:00Z',
        corridas: [{ nombre: 'piloto', manifiesto: null, archivos: ['trazas.jsonl'] }],
      }),
    );
    const catalogo = await promesa;
    expect(catalogo.corridas[0].nombre).toBe('piloto');
    expect(catalogo.corridas[0].manifiesto).toBeNull();
  });

  it('un 404 se traduce a no-encontrado: el archivo todavia no existe', async () => {
    const promesa = TestBed.inject(EXPERIMENTO_REPOSITORY).obtenerResultados();
    await microtareas();
    http
      .expectOne('datos-experimento/salidas/resultados.json')
      .flush('no', { status: 404, statusText: 'Not Found' });
    await expect(promesa).rejects.toMatchObject({ codigo: 'no-encontrado' });
  });

  it('el index.html que devuelve nginx a una ruta inexistente tambien cuenta como no-encontrado', async () => {
    const promesa = TestBed.inject(EXPERIMENTO_REPOSITORY).obtenerManifiestoSalidas();
    await microtareas();
    http
      .expectOne('datos-experimento/salidas/manifiesto.json')
      .flush('<!doctype html><html><body>UniHelp</body></html>');
    await expect(promesa).rejects.toMatchObject({ codigo: 'no-encontrado' });
  });

  it('comprueba /health del backend elegido y rechaza si responde otra arquitectura', async () => {
    const repositorio = TestBed.inject(EXPERIMENTO_REPOSITORY);
    const promesa = repositorio.consultarSalud('B1', 'http://localhost:3001/');
    await microtareas();
    http.expectOne('http://localhost:3001/health').flush({
      estado: 'ok',
      arquitectura: 'B0',
      servicio: 'b0-directo',
      version: '0.1.0',
    });
    await expect(promesa).rejects.toBeInstanceOf(ErrorBackend);
    await expect(promesa).rejects.toMatchObject({ codigo: 'conflicto' });
  });
});
