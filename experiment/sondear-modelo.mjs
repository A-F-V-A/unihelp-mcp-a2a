// Sondeo de un proveedor ANTES de una campaña: una llamada minima por modelo
// con los MISMOS parametros que envia ClienteModelo (temperatura, top_p,
// max_completion_tokens, herramientas, parallel_tool_calls) y, si el proveedor
// lo expone, la lista de modelos disponibles. Sirve para saber si el endpoint
// acepta la peticion tal cual (decision 48) sin gastar una corrida.
//
//   node experiment/sondear-modelo.mjs --proveedor gemini gemini-2.5-flash gemini-2.5-pro
//   node experiment/sondear-modelo.mjs --proveedor openai gpt-5.5-2026-04-23
//
// La clave sale de GEMINI_API_KEY / OPENAI_API_KEY del entorno o de apps/b0-directo/.env.
import { readFileSync, existsSync } from 'node:fs';
import OpenAI from 'openai';

const URL_BASE = {
  openai: undefined,
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  ollama: 'http://localhost:11434/v1',
};
const VARIABLE = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', ollama: null };

const args = process.argv.slice(2);
const i = args.indexOf('--proveedor');
const proveedor = i >= 0 ? args[i + 1] : 'openai';
const modelos = args.filter((a, k) => a !== '--proveedor' && k !== i + 1);

const env = existsSync('apps/b0-directo/.env')
  ? Object.fromEntries(
      readFileSync('apps/b0-directo/.env', 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => l.split('=').map((s) => s.trim())),
    )
  : {};
const variable = VARIABLE[proveedor];
const apiKey = variable ? process.env[variable] || env[variable] : 'ollama';
if (variable && !apiKey) {
  console.error(`Falta ${variable} en el entorno o en apps/b0-directo/.env`);
  process.exit(1);
}
const cliente = new OpenAI({
  apiKey,
  maxRetries: 0,
  ...(URL_BASE[proveedor] ? { baseURL: URL_BASE[proveedor] } : {}),
});

try {
  const lista = await cliente.models.list();
  const nombres = [];
  for await (const m of lista) nombres.push(m.id);
  console.log(`modelos que publica ${proveedor} (${nombres.length}): ${nombres.sort().join(', ')}`);
} catch (e) {
  console.log(`(${proveedor} no permitio listar modelos: ${String(e.message).slice(0, 120)})`);
}

const admiteRazonamiento = (m) => /^(gpt-5|o\d)/.test(m);
for (const model of modelos) {
  const inicio = Date.now();
  try {
    const r = await cliente.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Responde en español.' },
        { role: 'user', content: 'Usa la herramienta hora_actual y luego di solo: listo' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'hora_actual',
            description: 'Devuelve la hora actual.',
            parameters: {
              type: 'object',
              properties: { zona: { type: 'string' } },
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: 'auto',
      parallel_tool_calls: false,
      ...(admiteRazonamiento(model) ? { reasoning_effort: 'none' } : {}),
      temperature: 0.2,
      top_p: 1,
      max_completion_tokens: 200,
    });
    const m = r.choices[0].message;
    const tc = (m.tool_calls ?? [])
      .map((t) => `${t.function.name}(${t.function.arguments})`)
      .join(' ');
    console.log(
      `${model}: OK en ${Date.now() - inicio} ms | herramienta: ${tc || 'ninguna'} | texto: ${JSON.stringify(m.content ?? '').slice(0, 80)} | tokens ${r.usage?.prompt_tokens}/${r.usage?.completion_tokens} cache ${r.usage?.prompt_tokens_details?.cached_tokens ?? 'n/d'}`,
    );
  } catch (e) {
    console.log(`${model}: ERROR ${e.status ?? ''} ${String(e.message).slice(0, 220)}`);
  }
}
