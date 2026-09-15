/**
 * Validador del mensaje de commit (hook `commit-msg`). Reglas en AGENTS.md.
 *
 * Garantiza tres cosas, sin depender de que una persona o una IA las recuerde:
 * 1. Ningun commit atribuye la autoria a una IA.
 * 2. Todo commit referencia la historia de usuario de `docs/08` que atiende.
 * 3. Todo commit explica como se resolvio.
 *
 * Uso manual: `node tools/git-hooks/validar-mensaje-commit.mjs <archivo-con-mensaje>`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HISTORIAS = resolve(RAIZ, 'docs', '08-historias-de-usuario.md');

const TIPOS = ['feat', 'fix', 'exp', 'docs', 'refactor', 'test', 'perf', 'build', 'ci', 'chore'];
const LARGO_MAXIMO_TITULO = 100;
const LARGO_MINIMO_RESOLUCION = 20;

/*
 * Frases de atribucion. Se buscan formas de firmar o acreditar, no la mera
 * mencion de un proveedor: el proyecto usa modelos de lenguaje y un commit
 * legitimo puede hablar de "cliente de Anthropic" o de un LLM.
 */
const ATRIBUCION_IA = [
  /co-authored-by:.*(claude|anthropic|openai|chatgpt|gpt|copilot|gemini|codex|cursor|\bai\b|\bia\b|bot\b)/i,
  /noreply@anthropic\.com/i,
  /claude\.(ai|com)/i,
  /\bclaude code\b/i,
  /generated (with|by)/i,
  /(written|created|made|authored|assisted) (with|by)/i,
  /generad[oa]s? (con|por)/i,
  /(hecho|escrito|creado|asistido|redactado)s? (con|por) (una |la )?(ia|inteligencia artificial|claude|chatgpt|copilot|gemini)/i,
  /\p{Extended_Pictographic}\s*(generated|generado)/iu,
  /🤖/u,
];

function limpiar(crudo) {
  // Git agrega comentarios (`#`) y, con --verbose, el diff bajo una linea de tijera.
  const sinDiff = crudo.split(/^# -+ >8 -+$/m)[0];
  return sinDiff
    .split(/\r?\n/)
    .filter((linea) => !linea.startsWith('#'))
    .join('\n')
    .trim();
}

function historiasDocumentadas() {
  if (!existsSync(HISTORIAS)) {
    return null;
  }
  return new Set([...readFileSync(HISTORIAS, 'utf8').matchAll(/^### (HU-\d+)/gm)].map((m) => m[1]));
}

function campo(mensaje, nombre) {
  // El valor va desde "Nombre:" hasta la siguiente linea "OtroCampo:" o el final.
  const patron = new RegExp(
    `^${nombre}:[ \\t]*([\\s\\S]*?)(?=^[A-Z][a-zA-Záéíóú]+:|$(?![\\s\\S]))`,
    'm',
  );
  const encontrado = mensaje.match(patron);
  return encontrado ? encontrado[1].trim() : null;
}

export function validar(crudo) {
  const mensaje = limpiar(crudo);
  const errores = [];

  if (mensaje === '' || /^(Merge|Revert|fixup!|squash!|amend!)/.test(mensaje)) {
    return errores;
  }

  // Nombres de archivos del repositorio que contienen la palabra, no son atribucion.
  const paraAtribucion = mensaje.replace(/CLAUDE\.md|\.claude\/[\w./-]*/gi, '');
  if (ATRIBUCION_IA.some((patron) => patron.test(paraAtribucion))) {
    errores.push(
      'El mensaje atribuye el commit a una IA (Co-Authored-By, "Generated with", etc.). Esta prohibido: quita esa linea.',
    );
  }

  const [titulo] = mensaje.split('\n');
  const formatoTitulo = new RegExp(`^(${TIPOS.join('|')})(\\([a-z0-9-]+\\))?: \\S.*$`);
  if (!formatoTitulo.test(titulo)) {
    errores.push(`El titulo debe ser "tipo(alcance): resumen". Tipos: ${TIPOS.join(', ')}.`);
  } else if (titulo.length > LARGO_MAXIMO_TITULO) {
    errores.push(`El titulo tiene ${titulo.length} caracteres; maximo ${LARGO_MAXIMO_TITULO}.`);
  }
  const tipo = titulo.match(/^(\w+)/)?.[1];

  const historia = campo(mensaje, 'Historia');
  if (historia === null || historia === '') {
    errores.push('Falta la linea "Historia: HU-xx" (o "Historia: ninguna — motivo" si no aplica).');
  } else if (/^ninguna\b/i.test(historia)) {
    if (tipo === 'feat') {
      errores.push('Un "feat" siempre atiende una historia de usuario de docs/08.');
    }
    if (historia.replace(/^ninguna\W*/i, '').length < 5) {
      errores.push(
        '"Historia: ninguna" debe explicar el motivo: "Historia: ninguna — ajuste de CI".',
      );
    }
  } else {
    const codigos = historia.match(/\bHU-[A-Z]*-?\d+\b/g) ?? [];
    if (codigos.length === 0) {
      errores.push(
        'La linea "Historia:" debe contener codigos HU-xx de docs/08-historias-de-usuario.md.',
      );
    }
    const conocidas = historiasDocumentadas();
    if (conocidas) {
      const desconocidas = codigos.filter((codigo) => !conocidas.has(codigo));
      if (desconocidas.length > 0) {
        errores.push(
          `Historias que no existen en docs/08: ${desconocidas.join(', ')}. (Las HU-FE-xx aun no estan documentadas; ver AGENTS.md, discrepancias.)`,
        );
      }
    }
  }

  const resolucion = campo(mensaje, 'Resoluci[oó]n');
  if (resolucion === null || resolucion.replace(/\s+/g, '').length < LARGO_MINIMO_RESOLUCION) {
    errores.push(
      'Falta "Resolucion:" con la explicacion de como se resolvio la historia (que se cambio y por que).',
    );
  }

  return errores;
}

const archivo = process.argv[2];
if (archivo && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errores = validar(readFileSync(archivo, 'utf8'));
  if (errores.length > 0) {
    console.error('\nCommit rechazado:\n');
    for (const error of errores) {
      console.error(`  - ${error}`);
    }
    console.error(
      '\nFormato esperado (ver AGENTS.md, "Commits"):\n\n' +
        '  feat(web): propone ticket tras un diagnostico\n\n' +
        '  Historia: HU-13, HU-14\n' +
        '  Resolucion: el caso de uso ProponerTicket arma la propuesta desde la\n' +
        '  conversacion y la tarjeta pide confirmacion explicita antes de crearla.\n' +
        '  Pruebas: specs del store y del repositorio mock; validado en navegador.\n',
    );
    process.exit(1);
  }
}
