import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type PerfilSolicitante,
  PREFERENCIAS_POR_DEFECTO,
} from '../../../domain/models/preferencias';
import type { CatalogoModeloIa, SeleccionModeloIa } from '../../../domain/models/modelo-ia';
import { CONFIGURACION_APP } from '../../../nucleo/configuracion';
import { SettingsPanel } from './settings-panel';

const CATALOGO: CatalogoModeloIa = {
  proveedores: [
    {
      id: 'chatgpt',
      nombre: 'ChatGPT',
      descripcion: 'Modelos GPT de OpenAI.',
      disponible: true,
      motivoNoDisponible: null,
      modelos: ['gpt-a', 'gpt-b'],
      modeloPorDefecto: 'gpt-a',
    },
    {
      id: 'claude',
      nombre: 'Claude',
      descripcion: 'Modelos Claude de Anthropic.',
      disponible: false,
      motivoNoDisponible: 'B0 todavía no integra este proveedor.',
      modelos: [],
      modeloPorDefecto: null,
    },
  ],
  seleccion: { proveedor: 'chatgpt', modelo: 'gpt-a' },
  claveConfigurada: true,
  editable: true,
};

function crear(catalogoModelo: CatalogoModeloIa = CATALOGO) {
  TestBed.configureTestingModule({
    imports: [SettingsPanel],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CONFIGURACION_APP, useValue: { backendUrl: 'http://localhost:3000', consolaUrl: 'http://consola:3030' } },
    ],
  });
  const fixture = TestBed.createComponent(SettingsPanel);
  fixture.componentRef.setInput('abierto', true);
  fixture.componentRef.setInput('preferencias', PREFERENCIAS_POR_DEFECTO);
  fixture.componentRef.setInput('catalogoModelo', catalogoModelo);
  fixture.componentRef.setInput('cantidadConversaciones', 3);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;

  const boton = (texto: string) => {
    const encontrado = [...el.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === texto,
    );
    if (!encontrado) {
      throw new Error(`No hay boton "${texto}"`);
    }
    return encontrado;
  };
  const escribir = (selector: string, valor: string) => {
    const campo = el.querySelector<HTMLInputElement>(selector);
    if (!campo) {
      throw new Error(`No hay campo ${selector}`);
    }
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  return { fixture, el, boton, escribir };
}

describe('SettingsPanel', () => {
  it('cambia tema y tamano de texto con controles segmentados', () => {
    const { fixture, boton } = crear();
    const temas: string[] = [];
    const tamanos: string[] = [];
    fixture.componentInstance.cambiarTema.subscribe((tema) => temas.push(tema));
    fixture.componentInstance.cambiarTamanoTexto.subscribe((tamano) => tamanos.push(tamano));

    expect(boton('Sistema').getAttribute('aria-checked')).toBe('true');
    boton('Oscuro').click();
    boton('Grande').click();

    expect(temas).toEqual(['oscuro']);
    expect(tamanos).toEqual(['grande']);
  });

  it('valida el perfil antes de emitirlo y vuelve a la pantalla principal', () => {
    const { fixture, el, boton, escribir } = crear();
    const guardados: PerfilSolicitante[] = [];
    fixture.componentInstance.guardarPerfil.subscribe((perfil) => guardados.push(perfil));

    el.querySelector<HTMLButtonElement>('.ajustes__avatar')?.click();
    fixture.detectChanges();

    escribir('input[type="email"]', 'ana@');
    boton('Guardar').click();
    fixture.detectChanges();
    expect(el.querySelector('.campo__error')?.textContent).toMatch(/correo válido/);
    expect(guardados).toEqual([]);

    escribir('input[autocomplete="name"]', 'Ana Rojas');
    escribir('input[type="email"]', 'ana@uni.edu.co');
    boton('Docente').click();
    fixture.detectChanges();
    boton('Guardar').click();
    fixture.detectChanges();

    expect(guardados).toEqual([{ nombre: 'Ana Rojas', correo: 'ana@uni.edu.co', rol: 'docente' }]);
    expect(el.querySelector('.ajustes__avatar')).not.toBeNull();
  });

  it('pide confirmacion antes de borrar las conversaciones', () => {
    const { fixture, el, boton } = crear();
    let borrados = 0;
    fixture.componentInstance.borrarConversaciones.subscribe(() => (borrados += 1));

    boton('Borrar todas las conversaciones').click();
    fixture.detectChanges();
    expect(borrados).toBe(0);
    expect(el.textContent).toContain('Se eliminarán 3 conversaciones');

    boton('Borrar conversaciones').click();
    expect(borrados).toBe(1);
  });

  it('resume el proveedor y el modelo que reporta el backend', () => {
    const { el } = crear();
    expect(el.querySelector('[data-resumen-modelo]')?.textContent?.trim()).toBe('ChatGPT · gpt-a');
  });

  it('avisa "Sin configurar" cuando el backend no tiene la clave', () => {
    const { el } = crear({ ...CATALOGO, claveConfigurada: false });
    expect(el.querySelector('[data-resumen-modelo]')?.textContent?.trim()).toBe('ChatGPT');
  });

  it('no pide la clave de API: vive en el servidor (decision 27)', () => {
    const { fixture, el } = crear();
    el.querySelector<HTMLButtonElement>('[data-resumen-modelo]')?.closest('button')?.click();
    fixture.detectChanges();

    expect(el.querySelector('input[type="password"]')).toBeNull();
    expect(el.querySelector('input[type="url"]')).toBeNull();
    expect(el.textContent).toContain('La clave del proveedor vive en el servidor');
  });

  it('emite proveedor y modelo elegidos entre los que habilita el servidor', () => {
    const { fixture, el, boton } = crear();
    const guardados: SeleccionModeloIa[] = [];
    fixture.componentInstance.guardarModeloIA.subscribe((seleccion) => guardados.push(seleccion));

    el.querySelector<HTMLButtonElement>('[data-resumen-modelo]')?.closest('button')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-modelo="gpt-b"]')?.click();
    fixture.detectChanges();
    boton('Guardar').click();

    expect(guardados).toEqual([{ proveedor: 'chatgpt', modelo: 'gpt-b' }]);
  });

  it('un proveedor no disponible se muestra con su motivo y no se puede elegir', () => {
    const { fixture, el } = crear();
    el.querySelector<HTMLButtonElement>('[data-resumen-modelo]')?.closest('button')?.click();
    fixture.detectChanges();

    const claude = el.querySelector<HTMLButtonElement>('[data-proveedor="claude"]');
    expect(claude?.disabled).toBe(true);
    expect(claude?.textContent).toContain('todavía no integra');

    claude?.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-proveedor="chatgpt"]')?.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('bloquea la pantalla y muestra el error cuando el backend no admite cambios', () => {
    const { fixture, el, boton } = crear({ ...CATALOGO, editable: false });
    fixture.componentRef.setInput('errorModelo', 'El servidor rechazó el cambio.');
    el.querySelector<HTMLButtonElement>('[data-resumen-modelo]')?.closest('button')?.click();
    fixture.detectChanges();

    expect(el.querySelector('[data-modelo-bloqueado]')).not.toBeNull();
    expect(el.querySelector('[data-error-modelo]')?.textContent).toContain('rechazó');
    expect(boton('Guardar').disabled).toBe(true);
  });
});
