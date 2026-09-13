import type { Preferencias } from '../../domain/models/preferencias';

const COLOR_BARRA = { claro: '#ffffff', oscuro: '#151517' } as const;

/**
 * Refleja las preferencias visuales en el documento: el tema y el tamano de
 * texto se leen desde CSS (`data-tema`, `data-texto`) y el color de la barra
 * del navegador acompana al tema.
 */
export function aplicarApariencia(
  preferencias: Preferencias,
  documento: Document = document,
): void {
  const raiz = documento.documentElement;
  raiz.dataset['tema'] = preferencias.tema;
  raiz.dataset['texto'] = preferencias.tamanoTexto;

  const sistemaOscuro =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  const oscuro =
    preferencias.tema === 'oscuro' || (preferencias.tema === 'sistema' && sistemaOscuro);
  documento
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', oscuro ? COLOR_BARRA.oscuro : COLOR_BARRA.claro);
}
