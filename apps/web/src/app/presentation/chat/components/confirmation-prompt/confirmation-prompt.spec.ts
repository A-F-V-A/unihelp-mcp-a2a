import { TestBed } from '@angular/core/testing';
import type { PropuestaTicket } from '../../../../domain/models/ticket';
import { ConfirmationPrompt } from './confirmation-prompt';

const PROPUESTA: PropuestaTicket = {
  id: 'prop-1',
  conversacionId: 'conv-1',
  servicio: 'financiera',
  categoria: 'Pagos en línea',
  prioridad: 'alta',
  resumen: 'No es posible pagar la matrícula por PSE',
  descripcion: 'El solicitante reporta: «No puedo pagar».',
  estado: 'pendiente',
  creadaEn: new Date(),
  resueltaEn: null,
  ticketNumero: null,
};

function crear(propuesta: PropuestaTicket) {
  const fixture = TestBed.createComponent(ConfirmationPrompt);
  fixture.componentRef.setInput('propuesta', propuesta);
  fixture.detectChanges();
  const confirmar = jest.fn();
  const rechazar = jest.fn();
  fixture.componentInstance.confirmar.subscribe(confirmar);
  fixture.componentInstance.rechazar.subscribe(rechazar);
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el, confirmar, rechazar };
}

describe('ConfirmationPrompt', () => {
  it('muestra servicio, categoria, prioridad y descripcion (HU-FE-16)', () => {
    const { el } = crear(PROPUESTA);
    const texto = el.textContent ?? '';

    expect(texto).toContain('Gestion financiera y pagos');
    expect(texto).toContain('Pagos en línea');
    expect(texto).toContain('Alta');
    expect(texto).toContain('No puedo pagar');
  });

  it('solo emite confirmar al pulsar el boton, nunca al renderizar (HU-FE-17)', () => {
    const { el, confirmar, rechazar } = crear(PROPUESTA);
    expect(confirmar).not.toHaveBeenCalled();

    el.querySelector<HTMLButtonElement>('[data-accion="confirmar"]')?.click();

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(rechazar).not.toHaveBeenCalled();
  });

  it('Rechazar tiene el mismo tipo de boton que Confirmar (HU-FE-18)', () => {
    const { el, rechazar } = crear(PROPUESTA);
    const botones = [...el.querySelectorAll<HTMLButtonElement>('.boton-decision')];

    expect(botones.map((b) => b.dataset['accion'])).toEqual(['confirmar', 'rechazar']);
    botones[1].click();
    expect(rechazar).toHaveBeenCalledTimes(1);
  });

  it('una propuesta rechazada queda descartada y sin boton de confirmar', () => {
    const { el } = crear({ ...PROPUESTA, estado: 'rechazada' });

    expect(el.querySelector('[data-accion="confirmar"]')).toBeNull();
    expect(el.textContent).toContain('ya no puede confirmarse');
  });

  it('una propuesta confirmada se marca resuelta con el numero de ticket', () => {
    const { el } = crear({ ...PROPUESTA, estado: 'confirmada', ticketNumero: 'UH-2026-001208' });

    expect(el.querySelector('.boton-decision')).toBeNull();
    expect(el.textContent).toContain('UH-2026-001208');
  });

  it('deshabilita ambas acciones mientras una esta en curso', () => {
    const { fixture, el } = crear(PROPUESTA);
    fixture.componentRef.setInput('accion', 'confirmando');
    fixture.detectChanges();

    const botones = [...el.querySelectorAll<HTMLButtonElement>('.boton-decision')];
    expect(botones.every((b) => b.disabled)).toBe(true);
    expect(botones[0].textContent).toContain('Creando ticket');
  });
});
