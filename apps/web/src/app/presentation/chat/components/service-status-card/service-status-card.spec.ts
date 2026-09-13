import { TestBed } from '@angular/core/testing';
import type { EstadoServicio } from '../../../../domain/models/servicio';
import { ServiceStatusCard } from './service-status-card';

const CORREO: EstadoServicio = {
  servicio: 'soporte-tecnico',
  nombre: 'Correo institucional',
  estado: 'interrumpido',
  componenteAfectado: 'Servidor SMTP',
  alcance: 'Todas las cuentas',
  ventanaEstimada: null,
  incidenteId: 'INC-1',
  actualizadoEn: new Date(),
};

function renderizar(estado: EstadoServicio): HTMLElement {
  const fixture = TestBed.createComponent(ServiceStatusCard);
  fixture.componentRef.setInput('estado', estado);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('ServiceStatusCard (HU-FE-14)', () => {
  it('muestra estado, componente afectado y alcance', () => {
    const texto = renderizar(CORREO).textContent ?? '';
    expect(texto).toContain('Interrumpido');
    expect(texto).toContain('Servidor SMTP');
    expect(texto).toContain('Todas las cuentas');
  });

  it('sin ventana estimada lo dice explicitamente', () => {
    const el = renderizar(CORREO);
    expect(el.querySelector('[data-sin-ventana]')?.textContent).toContain('Sin ventana estimada');
  });

  it('con ventana estimada muestra el intervalo', () => {
    const inicio = new Date();
    const fin = new Date(inicio.getTime() + 60 * 60_000);
    const el = renderizar({ ...CORREO, estado: 'degradado', ventanaEstimada: { inicio, fin } });

    expect(el.querySelector('[data-sin-ventana]')).toBeNull();
    expect(el.textContent).toMatch(/–/);
  });
});
