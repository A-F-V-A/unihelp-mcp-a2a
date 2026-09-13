import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideDataLayer } from '../../../infrastructure/provide-data-layer';
import type { ConfiguracionSimulacion } from '../../../infrastructure/mock/configuracion-simulacion';
import { CONFIGURACION_APP } from '../../../nucleo/configuracion';
import { ChatPage } from './chat-page';

/*
 * Prueba de extremo a extremo de la pantalla con la capa de datos SIMULADA
 * (sin latencia). La pagina se configura exactamente como en la app: solo
 * cambia el valor de `provideDataLayer`.
 */

function montar(simulacion: Partial<ConfiguracionSimulacion> = {}) {
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  sessionStorage.clear();
  TestBed.configureTestingModule({
    imports: [ChatPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CONFIGURACION_APP, useValue: { backendUrl: 'http://localhost:3000' } },
      provideDataLayer({
        useMockBackend: true,
        simulacion: {
          latenciaMinimaMs: 0,
          latenciaMaximaMs: 0,
          esperaTimeoutMs: 0,
          persistirEnSesion: false,
          sembrarConversaciones: false,
          ...simulacion,
        },
      }),
    ],
  });
  const fixture = TestBed.createComponent(ChatPage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

function escribir(fixture: ComponentFixture<ChatPage>, texto: string): void {
  const el: HTMLElement = fixture.nativeElement;
  const campo = el.querySelector<HTMLTextAreaElement>('textarea');
  if (!campo) {
    throw new Error('No hay campo de texto');
  }
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  el.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  fixture.detectChanges();
}

async function esperarHasta(fixture: ComponentFixture<ChatPage>, condicion: () => boolean) {
  for (let intento = 0; intento < 50; intento++) {
    await new Promise((resolver) => setTimeout(resolver, 0));
    fixture.detectChanges();
    if (condicion()) {
      return;
    }
  }
  throw new Error('La condicion no se cumplio a tiempo');
}

describe('ChatPage con backend simulado', () => {
  it('pide aclaracion ante un texto muy corto', async () => {
    const { fixture, el } = montar();

    escribir(fixture, 'ayuda');

    expect(el.querySelector('[data-rol="aclaracion"]')?.textContent).toContain('ayuda');
    expect(el.querySelector('[data-rol="usuario"]')).toBeNull();
  });

  it('flujo completo: diagnostico, estado, propuesta y ticket creado solo al confirmar', async () => {
    const { fixture, el } = montar();

    escribir(fixture, 'No puedo entregar la tarea en el aula virtual');

    // HU-FE-08: indicador visible y campo deshabilitado mientras se espera.
    expect(el.querySelector('app-typing-indicator')).not.toBeNull();
    expect(el.querySelector<HTMLTextAreaElement>('textarea')?.disabled).toBe(true);

    await esperarHasta(fixture, () => el.querySelector('app-confirmation-prompt') !== null);

    expect(el.querySelector('app-typing-indicator')).toBeNull();
    expect(el.querySelector('.clasificacion')?.getAttribute('data-tipo')).toBe('diagnostico');
    expect(el.querySelector('app-service-status-card')?.textContent).toContain('Degradado');
    expect(el.querySelector('[data-turnos]')?.textContent).toMatch(/Turno\s*1\s*de\s*8/);
    expect(el.querySelector('app-ticket-created-card')).toBeNull();

    el.querySelector<HTMLButtonElement>('[data-accion="confirmar"]')?.click();
    await esperarHasta(fixture, () => el.querySelector('app-ticket-created-card') !== null);

    const tarjeta = el.querySelector('app-ticket-created-card');
    expect(tarjeta?.querySelector('[data-numero]')?.textContent).toMatch(/UH-2026-\d{6}/);
    expect(tarjeta?.querySelector('[data-estado]')?.textContent).toContain('Asignado');
    expect(el.querySelector('.propuesta')?.getAttribute('data-estado')).toBe('confirmada');
    expect(el.querySelector('[data-accion="confirmar"]')).toBeNull();
  });

  it.each([
    ['¿Cómo recupero mi contraseña olvidada?', 'informativa', 'app-policy-citation'],
    ['No puedo pagar la matrícula por PSE y vence el plazo', 'compuesta', 'app-policy-citation'],
    ['¿Dónde puedo parquear el carro?', 'fuera-de-alcance', 'app-scope-warning-banner'],
    ['¿Puedo renovar un libro de la biblioteca?', 'diagnostico', 'app-maintenance-notice'],
  ])('"%s" se muestra como %s con %s', async (texto, tipo, componente) => {
    const { fixture, el } = montar();

    escribir(fixture, texto);
    await esperarHasta(fixture, () => el.querySelector('.clasificacion') !== null);

    expect(el.querySelector('.clasificacion')?.getAttribute('data-tipo')).toBe(tipo);
    expect(el.querySelector(componente)).not.toBeNull();
    expect(el.querySelectorAll('app-policy-citation').length).toBeLessThanOrEqual(3);
  });

  it('el aviso fuera de alcance indica el canal correcto', async () => {
    const { fixture, el } = montar();

    escribir(fixture, '¿Dónde puedo parquear el carro?');
    await esperarHasta(fixture, () => el.querySelector('app-scope-warning-banner') !== null);

    expect(el.querySelector('app-scope-warning-banner')?.textContent).toContain(
      'Oficina de Seguridad y Movilidad',
    );
  });

  it('muestra el error tipado y lo recupera con Reintentar', async () => {
    const { fixture, el } = montar({
      errorForzado: { codigo: 'servicio-no-disponible', operacion: 'enviarMensaje' },
    });

    escribir(fixture, 'Los correos institucionales no salen');
    await esperarHasta(fixture, () => el.querySelector('app-error-message') !== null);

    expect(el.querySelector('[data-codigo]')?.getAttribute('data-codigo')).toBe(
      'servicio-no-disponible',
    );
    expect(el.querySelector('app-error-message button')?.textContent).toContain('Reintentar');
  });

  it('reemplaza el campo por el aviso de limite de turnos', async () => {
    const { fixture, el } = montar({ turnosMaximos: 1 });

    escribir(fixture, 'Los correos institucionales no salen');
    await esperarHasta(fixture, () => el.querySelector('app-turn-limit-notice') !== null);

    expect(el.querySelector('textarea')).toBeNull();

    el.querySelector<HTMLButtonElement>('app-turn-limit-notice button')?.click();
    fixture.detectChanges();
    expect(el.querySelector('textarea')).not.toBeNull();
    expect(el.querySelector('[data-rol]')).toBeNull();
  });

  it('nueva conversacion deja la anterior en el historial y se puede volver a abrir', async () => {
    const { fixture, el } = montar();
    const primerTitulo = () => el.querySelector('app-side-drawer .cajon__titulo');

    escribir(fixture, '¿Dónde puedo parquear la moto?');
    await esperarHasta(fixture, () => el.querySelector('app-scope-warning-banner') !== null);
    await esperarHasta(fixture, () => primerTitulo() !== null);
    expect(primerTitulo()?.textContent).toContain('Parqueadero del campus');

    el.querySelector<HTMLButtonElement>('.cabecera__nueva')?.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-rol]')).toBeNull();
    expect(el.querySelector('app-welcome-panel')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('app-side-drawer .cajon__item--conversacion')?.click();
    await esperarHasta(fixture, () => el.querySelector('app-scope-warning-banner') !== null);

    expect(el.querySelector('[data-rol="usuario"]')?.textContent).toContain('parquear');
    expect(el.querySelector('.cajon__conversacion--activa .cajon__titulo')?.textContent).toContain(
      'Parqueadero del campus',
    );
  });

  it('mis tickets reune los tickets creados en la sesion', async () => {
    const { fixture, el } = montar();
    const hojaTickets = () =>
      el.querySelector('app-bottom-sheet [aria-label="Mis tickets"]')?.closest('.hoja');

    escribir(fixture, 'No puedo entregar la tarea en el aula virtual');
    await esperarHasta(fixture, () => el.querySelector('[data-accion="confirmar"]') !== null);
    el.querySelector<HTMLButtonElement>('[data-accion="confirmar"]')?.click();
    await esperarHasta(fixture, () => el.querySelector('app-ticket-created-card') !== null);

    const botonTickets = el.querySelector('app-side-drawer .cajon__contador')?.closest('button');
    expect(botonTickets?.textContent).toContain('1');
    botonTickets?.click();
    fixture.detectChanges();

    expect(hojaTickets()?.classList.contains('hoja--abierta')).toBe(true);
    expect(hojaTickets()?.querySelector('[data-ticket]')?.textContent).toMatch(/UH-2026-\d{6}/);
  });

  it('el modelo de IA se ve y se configura desde el chat, no solo dentro de Configuración', async () => {
    const { fixture, el } = montar();
    const hojaAcerca = () =>
      el.querySelector('app-bottom-sheet [aria-label="Cómo funciona UniHelp"]')?.closest('.hoja');
    const hojaAjustes = () =>
      el.querySelector('app-bottom-sheet [aria-label="Configuración"]')?.closest('.hoja');

    el.querySelector<HTMLButtonElement>('.cabecera__pastilla')?.click();
    fixture.detectChanges();
    expect(hojaAcerca()?.querySelector('[data-resumen-modelo-acerca]')?.textContent).toContain(
      'sin configurar',
    );

    hojaAcerca()?.querySelector<HTMLButtonElement>('.boton-secundario')?.click();
    fixture.detectChanges();
    expect(hojaAjustes()?.classList.contains('hoja--abierta')).toBe(true);
    expect(hojaAjustes()?.querySelector('[data-resumen-modelo]')?.textContent?.trim()).toBe(
      'Sin configurar',
    );

    hojaAjustes()
      ?.querySelector<HTMLButtonElement>('[data-resumen-modelo]')
      ?.closest('button')
      ?.click();
    fixture.detectChanges();
    hojaAjustes()?.querySelector<HTMLButtonElement>('[data-proveedor="gemini"]')?.click();
    fixture.detectChanges();
    const campoToken = hojaAjustes()?.querySelector<HTMLInputElement>('input[type="password"]');
    campoToken!.value = 'sk-gemini-123';
    campoToken!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    hojaAjustes()?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    fixture.detectChanges();

    expect(hojaAjustes()?.querySelector('[data-resumen-modelo]')?.textContent?.trim()).toBe(
      'Gemini',
    );

    el.querySelector<HTMLButtonElement>('.hoja--abierta .hoja__cerrar')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.cabecera__pastilla')?.click();
    fixture.detectChanges();
    expect(hojaAcerca()?.querySelector('[data-resumen-modelo-acerca]')?.textContent?.trim()).toBe(
      'Gemini',
    );
  });
});
