import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BottomSheet } from './bottom-sheet';

@Component({
  imports: [BottomSheet],
  template: `
    <app-bottom-sheet etiqueta="Prueba" [abierto]="abierto()" (cerrar)="cierres = cierres + 1">
      <button type="button" class="dentro">Continuar</button>
    </app-bottom-sheet>
  `,
})
class Anfitrion {
  readonly abierto = signal(false);
  cierres = 0;
}

function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el, raiz: () => el.querySelector<HTMLElement>('.hoja') };
}

describe('BottomSheet', () => {
  it('cerrada queda inerte para teclado y lectores de pantalla', () => {
    const { raiz } = montar();
    expect(raiz()?.hasAttribute('inert')).toBe(true);
    expect(raiz()?.classList.contains('hoja--abierta')).toBe(false);
  });

  it('abierta es un dialogo modal con nombre accesible y contenido proyectado', () => {
    const { fixture, el, raiz } = montar();
    fixture.componentInstance.abierto.set(true);
    fixture.detectChanges();

    const dialogo = el.querySelector('[role="dialog"]');
    expect(raiz()?.hasAttribute('inert')).toBe(false);
    expect(dialogo?.getAttribute('aria-modal')).toBe('true');
    expect(dialogo?.getAttribute('aria-label')).toBe('Prueba');
    expect(el.querySelector('.dentro')).not.toBeNull();
  });

  it('se cierra con la X, tocando el fondo y con Escape (solo si esta abierta)', () => {
    const { fixture, el } = montar();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.cierres).toBe(0);

    fixture.componentInstance.abierto.set(true);
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.hoja__cerrar')?.click();
    el.querySelector<HTMLElement>('.hoja__fondo')?.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(fixture.componentInstance.cierres).toBe(3);
  });
});
