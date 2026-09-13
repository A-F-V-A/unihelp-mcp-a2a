import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  CHAT_REPOSITORY,
  POLITICA_REPOSITORY,
  SERVICIO_REPOSITORY,
  TICKET_REPOSITORY,
} from '../application/di/tokens';
import { CONFIGURACION_APP } from '../nucleo/configuracion';
import { HttpChatRepository } from './http/http-chat.repository';
import { HttpPoliticaRepository } from './http/http-politica.repository';
import { HttpServicioRepository } from './http/http-servicio.repository';
import { HttpTicketRepository } from './http/http-ticket.repository';
import { MockChatRepository } from './mock/mock-chat.repository';
import { MockPoliticaRepository } from './mock/mock-politica.repository';
import { MockServicioRepository } from './mock/mock-servicio.repository';
import { MockTicketRepository } from './mock/mock-ticket.repository';
import { USE_MOCK_BACKEND, provideDataLayer } from './provide-data-layer';

function puertosCon(useMockBackend: boolean) {
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: CONFIGURACION_APP, useValue: { backendUrl: 'http://localhost:3000' } },
      provideDataLayer({ useMockBackend }),
    ],
  });
  return [
    TestBed.inject(CHAT_REPOSITORY),
    TestBed.inject(TICKET_REPOSITORY),
    TestBed.inject(POLITICA_REPOSITORY),
    TestBed.inject(SERVICIO_REPOSITORY),
  ];
}

describe('provideDataLayer (HU-FE-04)', () => {
  it('USE_MOCK_BACKEND=true registra los cuatro repositorios simulados', () => {
    expect(puertosCon(true)).toEqual([
      expect.any(MockChatRepository),
      expect.any(MockTicketRepository),
      expect.any(MockPoliticaRepository),
      expect.any(MockServicioRepository),
    ]);
    expect(TestBed.inject(USE_MOCK_BACKEND)).toBe(true);
  });

  it('USE_MOCK_BACKEND=false registra los cuatro repositorios HTTP', () => {
    expect(puertosCon(false)).toEqual([
      expect.any(HttpChatRepository),
      expect.any(HttpTicketRepository),
      expect.any(HttpPoliticaRepository),
      expect.any(HttpServicioRepository),
    ]);
  });
});
