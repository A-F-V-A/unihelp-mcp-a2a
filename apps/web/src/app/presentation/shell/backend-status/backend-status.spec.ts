import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RespuestaSalud } from '@unihelp/contratos';
import { CONFIGURACION_APP } from '../../../nucleo/configuracion';
import { BackendStatus } from './backend-status';

const BACKEND_URL = 'http://backend-de-prueba:3000';

const SALUD_B2: RespuestaSalud = {
  estado: 'ok',
  arquitectura: 'B2',
  servicio: 'b2-multiagente-local',
  rol: 'orquestador',
  protocolo: 'en-proceso',
  descripcion: 'Agentes coordinados en el mismo proceso.',
  consumidoPor: ['B2'],
  dependencias: [],
  version: '0.1.0',
  marcaTiempo: '2026-01-01T00:00:00.000Z',
  tiempoActividadSegundos: 12,
};

describe('BackendStatus', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BackendStatus],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIGURACION_APP, useValue: { backendUrl: BACKEND_URL, consolaUrl: 'http://consola:3030' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta /health del backend configurado, no de una URL fija', () => {
    const fixture = TestBed.createComponent(BackendStatus);
    fixture.detectChanges();

    http.expectOne(`${BACKEND_URL}/health`).flush(SALUD_B2);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('B2');
  });

  it('avisa cuando no hay arquitectura levantada', () => {
    const fixture = TestBed.createComponent(BackendStatus);
    fixture.detectChanges();

    http
      .expectOne(`${BACKEND_URL}/health`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(boton.textContent).toContain('no detectada');
    expect(boton.title).toContain('No hay respuesta');
  });
});
