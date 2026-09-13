import { PREFERENCIAS_POR_DEFECTO } from '../../domain/models/preferencias';
import { aplicarApariencia } from './apariencia';

describe('aplicarApariencia', () => {
  it('marca el tema y el tamano de texto en el documento y ajusta la barra del navegador', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);

    aplicarApariencia({ ...PREFERENCIAS_POR_DEFECTO, tema: 'oscuro', tamanoTexto: 'grande' });

    expect(document.documentElement.dataset['tema']).toBe('oscuro');
    expect(document.documentElement.dataset['texto']).toBe('grande');
    expect(meta.getAttribute('content')).toBe('#151517');

    aplicarApariencia({ ...PREFERENCIAS_POR_DEFECTO, tema: 'claro' });
    expect(meta.getAttribute('content')).toBe('#ffffff');
    meta.remove();
  });
});
