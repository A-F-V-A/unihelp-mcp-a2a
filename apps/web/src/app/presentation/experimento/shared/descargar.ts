/**
 * Descarga de graficas y tablas desde el navegador. Las graficas del panel son
 * SVG con colores en variables CSS; para que el archivo se vea igual fuera de
 * la pagina, se copian los estilos calculados de cada nodo antes de serializar.
 */

const PROPIEDADES_SVG = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'font-family',
  'font-size',
  'font-weight',
  'opacity',
] as const;

export function serializarSvg(svg: SVGSVGElement): string {
  const copia = svg.cloneNode(true) as SVGSVGElement;
  const originales = svg.querySelectorAll<SVGElement>('*');
  const copias = copia.querySelectorAll<SVGElement>('*');
  originales.forEach((original, indice) => {
    const estilo = getComputedStyle(original);
    const destino = copias[indice];
    for (const propiedad of PROPIEDADES_SVG) {
      const valor = estilo.getPropertyValue(propiedad);
      if (valor) {
        destino.style.setProperty(propiedad, valor);
      }
    }
  });
  const fondo = getComputedStyle(svg).getPropertyValue('--color-superficie').trim() || '#ffffff';
  copia.style.setProperty('background', fondo);
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!copia.getAttribute('width') && svg.viewBox.baseVal.width) {
    copia.setAttribute('width', String(svg.viewBox.baseVal.width));
    copia.setAttribute('height', String(svg.viewBox.baseVal.height));
  }
  return new XMLSerializer().serializeToString(copia);
}

export function descargarSvg(svg: SVGSVGElement, nombre: string): void {
  descargarBlob(new Blob([serializarSvg(svg)], { type: 'image/svg+xml' }), `${nombre}.svg`);
}

/** Dibuja el SVG en un lienzo al doble de resolucion y lo entrega como PNG. */
export async function descargarPng(svg: SVGSVGElement, nombre: string): Promise<void> {
  const escala = 2;
  const ancho = svg.viewBox.baseVal.width || svg.clientWidth;
  const alto = svg.viewBox.baseVal.height || svg.clientHeight;
  const fondo = getComputedStyle(svg).getPropertyValue('--color-superficie').trim() || '#ffffff';
  const url = URL.createObjectURL(new Blob([serializarSvg(svg)], { type: 'image/svg+xml' }));
  try {
    const imagen = await cargarImagen(url);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho * escala;
    lienzo.height = alto * escala;
    const contexto = lienzo.getContext('2d');
    if (!contexto) {
      return;
    }
    contexto.fillStyle = fondo;
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    lienzo.toBlob((blob) => blob && descargarBlob(blob, `${nombre}.png`), 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Tabla de valores de una grafica como CSV con punto y coma, que Excel en español abre directo. */
export function descargarCsv(
  encabezados: readonly string[],
  filas: readonly (readonly (string | number | null)[])[],
  nombre: string,
): void {
  const celda = (valor: string | number | null) =>
    valor === null ? '' : `"${String(valor).replace(/"/g, '""')}"`;
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celda).join(';'));
  descargarBlob(
    // La marca de orden de bytes hace que Excel abra el CSV como UTF-8 y respete las tildes.
    new Blob([String.fromCharCode(0xfeff), lineas.join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
    `${nombre}.csv`,
  );
}

export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error('No se pudo rasterizar la gráfica.'));
    imagen.src = url;
  });
}
