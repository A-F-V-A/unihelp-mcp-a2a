// Convierte INFORME-UNIHELP.md en INFORME-UNIHELP.docx con las imagenes incrustadas.
// Los bloques Mermaid se reemplazan por su PNG (diagramas.mjs), que Word no sabe dibujar.
//
//   npm install --no-save docx@9 marked@15 image-size@1   (en cualquier carpeta; o NODE_PATH)
//   node docs/informe-final/a-word.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.UNIHELP_WORD_DEPS ?? import.meta.url);
const docx = require('docx');
const { marked } = require('marked');
const sizeOf = require('image-size');

const {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, ImageRun, LevelFormat,
  PageBreak, Packer, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun,
  WidthType, Footer, PageNumber,
} = docx;

const AQUI = dirname(fileURLToPath(import.meta.url));
const ANCHO_UTIL = 9638; // A4 con margenes de 2 cm, en DXA
const ANCHO_IMAGEN_PX = 640;
const NIVELES = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

function decodificar(texto) {
  return texto
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Tokens en linea -> TextRun / ExternalHyperlink.
function enLinea(tokens, estilo = {}) {
  const salida = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'strong':
        salida.push(...enLinea(t.tokens, { ...estilo, bold: true }));
        break;
      case 'em':
        salida.push(...enLinea(t.tokens, { ...estilo, italics: true }));
        break;
      case 'codespan':
        salida.push(new TextRun({ ...estilo, text: decodificar(t.text), font: 'Consolas', size: (estilo.size ?? 21) - 2 }));
        break;
      case 'link': {
        const hijos = enLinea(t.tokens, { ...estilo, color: '1F5FAD', underline: {} });
        salida.push(/^https?:/.test(t.href) ? new ExternalHyperlink({ link: t.href, children: hijos }) : hijos[0] ? hijos : []);
        break;
      }
      case 'br':
        salida.push(new TextRun({ break: 1 }));
        break;
      case 'image':
        break; // las imagenes se tratan como bloque
      case 'text':
        if (t.tokens) salida.push(...enLinea(t.tokens, estilo));
        else salida.push(new TextRun({ ...estilo, text: decodificar(t.text) }));
        break;
      default:
        if (t.text) salida.push(new TextRun({ ...estilo, text: decodificar(t.raw ?? t.text) }));
    }
  }
  return salida.flat();
}

function imagen(ruta) {
  const datos = readFileSync(join(AQUI, ruta));
  const { width, height } = sizeOf(datos);
  const ancho = Math.min(ANCHO_IMAGEN_PX, width);
  const alto = Math.round((height * ancho) / width);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
    children: [new ImageRun({ type: 'png', data: datos, transformation: { width: ancho, height: alto } })],
  });
}

function tabla(t) {
  const columnas = t.header.length;
  const tamano = columnas > 8 ? 13 : columnas > 5 ? 15 : 17;
  const anchoCol = Math.floor(ANCHO_UTIL / columnas);
  const anchos = Array(columnas).fill(anchoCol);
  anchos[columnas - 1] += ANCHO_UTIL - anchoCol * columnas;
  const borde = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  const celda = (tokens, i, cabecera) =>
    new TableCell({
      width: { size: anchos[i], type: WidthType.DXA },
      borders: { top: borde, bottom: borde, left: borde, right: borde },
      shading: cabecera ? { type: ShadingType.CLEAR, fill: 'E8EEF6', color: 'auto' } : undefined,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      children: [new Paragraph({ children: enLinea(tokens, { size: tamano, bold: cabecera || undefined }) })],
    });
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: anchos,
    rows: [
      new TableRow({ tableHeader: true, children: t.header.map((h, i) => celda(h.tokens, i, true)) }),
      ...t.rows.map((fila) => new TableRow({ children: fila.map((c, i) => celda(c.tokens, i, false)) })),
    ],
  });
}

function lista(t, nivel = 0) {
  const salida = [];
  for (const item of t.items) {
    let primero = true;
    for (const hijo of item.tokens) {
      if (hijo.type === 'list') {
        salida.push(...lista(hijo, nivel + 1));
      } else if (hijo.type === 'text' || hijo.type === 'paragraph') {
        salida.push(new Paragraph({
          numbering: primero ? { reference: t.ordered ? 'numeros' : 'vinetas', level: nivel } : undefined,
          indent: primero ? undefined : { left: 720 * (nivel + 1) },
          spacing: { after: 60 },
          children: enLinea(hijo.tokens ?? [{ type: 'text', text: hijo.text }]),
        }));
        primero = false;
      }
    }
  }
  return salida;
}

const md = readFileSync(join(AQUI, 'INFORME-UNIHELP.md'), 'utf8');
const tokens = marked.lexer(md);
const cuerpo = [];
let diagramaPendiente = null;
let primerH1 = true;

for (const t of tokens) {
  switch (t.type) {
    case 'heading': {
      if (t.depth === 1 && primerH1) {
        primerH1 = false;
        cuerpo.push(new Paragraph({ heading: HeadingLevel.TITLE, children: enLinea(t.tokens) }));
        break;
      }
      if (t.depth === 2 && /^\d/.test(t.text)) cuerpo.push(new Paragraph({ children: [new PageBreak()] }));
      if (t.depth === 2 && t.text === 'Índice') {
        cuerpo.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Índice')] }));
        cuerpo.push(new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-3' }));
        break;
      }
      cuerpo.push(new Paragraph({ heading: NIVELES[Math.min(t.depth - 1, 4)], children: enLinea(t.tokens) }));
      break;
    }
    case 'paragraph': {
      const imagenes = t.tokens.filter((x) => x.type === 'image');
      if (imagenes.length && t.tokens.every((x) => x.type === 'image' || (x.type === 'text' && !x.text.trim()))) {
        for (const im of imagenes) cuerpo.push(imagen(im.href));
        break;
      }
      const leyenda = /^\*Figura \d+/.test(t.raw.trim());
      cuerpo.push(new Paragraph({
        alignment: leyenda ? AlignmentType.CENTER : undefined,
        spacing: { after: 120 },
        children: enLinea(t.tokens, leyenda ? { size: 18, color: '555555' } : {}),
      }));
      break;
    }
    case 'list':
      cuerpo.push(...lista(t));
      break;
    case 'table':
      cuerpo.push(tabla(t), new Paragraph({ spacing: { after: 80 }, children: [] }));
      break;
    case 'html': {
      const m = t.raw.match(/diagrama:\s*([\w-]+)/);
      if (m) diagramaPendiente = m[1];
      break;
    }
    case 'code':
      if (t.lang === 'mermaid' && diagramaPendiente) {
        cuerpo.push(imagen(`imagenes/${diagramaPendiente}.png`));
        diagramaPendiente = null;
      } else {
        for (const linea of t.text.split('\n')) {
          cuerpo.push(new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: 'F3F3F3', color: 'auto' },
            spacing: { after: 0 },
            children: [new TextRun({ text: linea || ' ', font: 'Consolas', size: 17 })],
          }));
        }
        cuerpo.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      }
      break;
    case 'hr':
      cuerpo.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF', space: 1 } }, children: [] }));
      break;
    case 'blockquote':
      cuerpo.push(new Paragraph({ indent: { left: 720 }, children: enLinea(t.tokens?.[0]?.tokens) }));
      break;
    default:
      break;
  }
}

const doc = new Document({
  creator: 'Equipo UniHelp',
  title: 'UniHelp: informe final',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 40, bold: true, color: '1F3864' }, paragraph: { spacing: { after: 240 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: '2F5496' }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: '2F5496' }, paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'vinetas', levels: [0, 1, 2].map((n) => ({ level: n, format: LevelFormat.BULLET, text: ['•', '◦', '▪'][n], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (n + 1), hanging: 360 } } } })) },
      { reference: 'numeros', levels: [0, 1, 2].map((n) => ({ level: n, format: LevelFormat.DECIMAL, text: `%${n + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (n + 1), hanging: 360 } } } })) },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }) },
    children: cuerpo,
  }],
});

writeFileSync(join(AQUI, 'INFORME-UNIHELP.docx'), await Packer.toBuffer(doc));
console.log(`escrito INFORME-UNIHELP.docx (${cuerpo.length} bloques)`);
