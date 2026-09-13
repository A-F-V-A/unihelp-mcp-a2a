import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type PerfilSolicitante,
  PREFERENCIAS_POR_DEFECTO,
} from '../../../domain/models/preferencias';
import {
  CONFIGURACION_MODELO_POR_DEFECTO,
  type ConfiguracionModeloIA,
} from '../../../domain/models/proveedor-ia';
import { CONFIGURACION_APP } from '../../../nucleo/configuracion';
import { SettingsPanel } from './settings-panel';

function crear(configuracionModelo: ConfiguracionModeloIA = CONFIGURACION_MODELO_POR_DEFECTO) {
  TestBed.configureTestingModule({
    imports: [SettingsPanel],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CONFIGURACION_APP, useValue: { backendUrl: 'http://localhost:3000' } },
    ],
  });
  const fixture = TestBed.createComponent(SettingsPanel);
  fixture.componentRef.setInput('abierto', true);
  fixture.componentRef.setInput('preferencias', PREFERENCIAS_POR_DEFECTO);
  fixture.componentRef.setInput('configuracionModelo', configuracionModelo);
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

  it('muestra "Sin configurar" mientras el proveedor no tenga clave de API', () => {
    const { el } = crear();
    expect(el.querySelector('[data-resumen-modelo]')?.textContent?.trim()).toBe('Sin configurar');
  });

  it('muestra el nombre del proveedor una vez tiene clave de API', () => {
    const { el } = crear({ proveedor: 'gemini', modelo: '', token: 'sk-123', urlAgenteLocal: '' });
    expect(el.querySelector('[data-resumen-modelo]')?.textContent?.trim()).toBe('Gemini');
  });

  it('exige clave de API antes de guardar un proveedor en la nube', () => {
    const { fixture, el, boton } = crear();
    const guardados: ConfiguracionModeloIA[] = [];
    fixture.componentInstance.guardarModeloIA.subscribe((config) => guardados.push(config));

    el.querySelector<HTMLButtonElement>('[data-resumen-modelo]')?.closest('button')?.click();
    fixture.detectChanges();

    boton('Guardar').click();
    fixture.detectChanges();
    expect(el.querySelector('.campo__error')?.textContent).toMatch(/clave de API/);
    expect(guardados).toEqual([]);
    // El agente local, en cambio, no debe pedir URL mientras no este seleccionado.
    expect(el.querySelector('input[type="url"]')).toBeNull();

    const campoToken = el.querySelector<HTMLInputElement>('input[type="password"]');
    campoToken!.value = 'sk-abc';
    campoToken!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton('Guardar').click();
    fixture.detectChanges();

    expect(guardados).toEqual([
      { proveedor: 'chatgpt', modelo: '', token: 'sk-abc', urlAgenteLocal: '' },
    ]);
  });

  it('el agente local exige ademas la URL, y un chip completa el modelo sugerido', () => {
    const { fixture, el, boton } = crear();
    const guardados: ConfiguracionModeloIA[] = [];
    fixture.componentInstance.guardarModeloIA.subscribe((config) => guardados.push(config));

    el.querySelector<HTMLButtonElement>('[data-resumen-modelo]')?.closest('button')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-proveedor="local"]')?.click();
    fixture.detectChanges();

    expect(el.querySelector('input[type="url"]')).not.toBeNull();

    boton('Guardar').click();
    fixture.detectChanges();
    const textosDeError = () => [...el.querySelectorAll('.campo__error')].map((e) => e.textContent);
    expect(textosDeError()).toEqual([
      expect.stringMatching(/URL/),
      expect.stringMatching(/token de acceso/),
    ]);

    const campoUrl = el.querySelector<HTMLInputElement>('input[type="url"]');
    campoUrl!.value = 'agente-sin-protocolo.local';
    campoUrl!.dispatchEvent(new Event('input'));
    const campoToken = el.querySelector<HTMLInputElement>('input[type="password"]');
    campoToken!.value = 'tok-local';
    campoToken!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton('Guardar').click();
    fixture.detectChanges();

    expect(textosDeError()).toEqual([expect.stringMatching(/http/)]);
    expect(guardados).toEqual([]);

    campoUrl!.value = 'http://localhost:9000';
    campoUrl!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton('Guardar').click();

    expect(guardados).toEqual([
      {
        proveedor: 'local',
        modelo: '',
        token: 'tok-local',
        urlAgenteLocal: 'http://localhost:9000',
      },
    ]);
  });

  it('un chip de modelo sugerido completa el campo de texto', () => {
    const { fixture, el, boton } = crear();
    el.querySelector<HTMLButtonElement>('[data-resumen-modelo]')?.closest('button')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-proveedor="claude"]')?.click();
    fixture.detectChanges();

    boton('claude-sonnet-5').click();
    fixture.detectChanges();

    expect(el.querySelector<HTMLInputElement>('.campo__entrada[type="text"]')?.value).toBe(
      'claude-sonnet-5',
    );
  });

  it('el boton de mostrar/ocultar alterna el tipo del campo de token', () => {
    const { fixture, el } = crear({
      proveedor: 'chatgpt',
      modelo: '',
      token: 'sk-secreto',
      urlAgenteLocal: '',
    });
    el.querySelector<HTMLButtonElement>('[data-resumen-modelo]')?.closest('button')?.click();
    fixture.detectChanges();

    const campo = () => el.querySelector<HTMLInputElement>('.campo__con-boton input');
    expect(campo()?.type).toBe('password');

    el.querySelector<HTMLButtonElement>('.campo__boton-ojo')?.click();
    fixture.detectChanges();
    expect(campo()?.type).toBe('text');
    // Muestra solo los ultimos caracteres del token guardado, nunca el valor completo.
    expect(el.querySelector('.campo__ayuda-discreta')?.textContent).toContain('reto');
    expect(el.querySelector('.campo__ayuda-discreta')?.textContent).not.toContain('sk-secreto');
  });
});
