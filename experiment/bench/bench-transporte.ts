/**
 * Microbenchmark de transporte (M4.3, decision 55): latencia de una operacion
 * SIN trabajo util por cada transporte, sin ningun modelo.
 *
 * Levanta `mcp-server`, `b0-directo` y `b3-a2a-conocimiento` desde `dist/` en un
 * entorno aislado (puertos `3N00..3N10`, base `unihelp_cN`, como `campana.py`),
 * mide los cuatro transportes uno tras otro y escribe `bench-transport.json`
 * con TODAS las iteraciones (el cuaderno descarta el calentamiento).
 *
 * | Transporte             | Operacion                                                           |
 * | ---------------------- | ------------------------------------------------------------------- |
 * | `adaptador_local`      | `CapacidadesLocales.listar()` en proceso (el puerto de B0)            |
 * | `mcp_streamable_http`  | `ping` de MCP con el cliente del SDK sobre Streamable HTTP (B1, B2/B3) |
 * | `a2a_salto`            | `message/send` al especialista de conocimiento, rechazado por params  |
 * | `ruta_completa_http`   | `GET /health` de `b0-directo` con el cliente del ejecutor (httpx)     |
 *
 * Reglas: reloj monotono (`performance.now`, RM-06, D6); iteraciones en serie,
 * una sola peticion en vuelo (RM-04, D1); cada latencia se mide en ESTE proceso,
 * del envio a la respuesta completa, sin restar marcas de otro proceso (RM-05).
 * Los backends arrancan con `UNIHELP_MODO_LLM=replay` y un directorio de casetes
 * vacio: no hay clave y una llamada al modelo fallaria en vez de salir a la red.
 *
 * Uso (desde la raiz, con los backends ya compilados con `nx build`):
 *
 *     SWC_NODE_PROJECT=tsconfig.base.json node -r @swc-node/register experiment/bench/bench-transporte.ts
 *     ... --indice 9 --iteraciones 1000 --calentamiento 100 --salida experiment/bench-transport.json
 */
import 'reflect-metadata';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { CapacidadesLocales, CapacidadesModule } from '@unihelp/capacidades';
import {
  CABECERA_TRACE_ID,
  CODIGOS_JSONRPC,
  METODO_A2A_MESSAGE_SEND,
  RUTA_A2A,
  RUTA_MCP,
} from '@unihelp/contratos';

const RAIZ = resolve(__dirname, '..', '..');

interface Opciones {
  readonly indice: number;
  readonly iteraciones: number;
  readonly calentamiento: number;
  readonly salida: string;
}

function leerOpciones(argv: readonly string[]): Opciones {
  const valor = (nombre: string, porDefecto: string): string => {
    const i = argv.indexOf(`--${nombre}`);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : porDefecto;
  };
  const entero = (nombre: string, porDefecto: number): number => {
    const n = Number(valor(nombre, String(porDefecto)));
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`--${nombre} debe ser un entero no negativo.`);
    }
    return n;
  };
  return {
    indice: entero('indice', 9),
    iteraciones: entero('iteraciones', 1000),
    calentamiento: entero('calentamiento', 100),
    salida: resolve(RAIZ, valor('salida', 'experiment/bench-transport.json')),
  };
}

/** Desplazamiento de puerto de cada app dentro del entorno (igual que `campana.py`). */
const APPS = { 'mcp-server': 10, 'b0-directo': 0, 'b3-a2a-conocimiento': 4 } as const;
type App = keyof typeof APPS;

class Entorno {
  private readonly procesos: ChildProcess[] = [];
  readonly urlBd: string;
  private readonly casetes = mkdtempSync(join(tmpdir(), 'unihelp-bench-casetes-'));

  constructor(private readonly indice: number) {
    this.urlBd = `postgres://unihelp:unihelp@localhost:5432/unihelp_c${indice}`;
  }

  url(app: App): string {
    return `http://localhost:${3000 + 100 * this.indice + APPS[app]}`;
  }

  private variables(app: App): NodeJS.ProcessEnv {
    return {
      ...process.env,
      // Sin clave y en `replay`: ningun servicio puede llamar a un modelo.
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      UNIHELP_MODELO_PROVEEDOR: 'openai',
      UNIHELP_MODELO_ID: 'sin-modelo-bench',
      UNIHELP_MODELOS_PERMITIDOS: 'sin-modelo-bench',
      UNIHELP_MODELO_ESFUERZO: 'none',
      UNIHELP_MODO_LLM: 'replay',
      UNIHELP_DIRECTORIO_CASETES: this.casetes,
      UNIHELP_PERFIL: 'experimento',
      CONOCIMIENTO_DATABASE_URL: this.urlBd,
      TICKETS_DATABASE_URL: this.urlBd,
      PORT: new URL(this.url(app)).port,
      MCP_SERVER_URL: this.url('mcp-server'),
      A2A_SELF_URL: this.url(app),
      A2A_CONOCIMIENTO_URL: this.url('b3-a2a-conocimiento'),
      A2A_DIAGNOSTICO_URL: `http://localhost:${3000 + 100 * this.indice + 5}`,
      A2A_REGISTRY_PATH: join(RAIZ, 'apps/b3-a2a-orquestador/config/a2a-registry.yaml'),
    };
  }

  async arrancar(): Promise<void> {
    const logs = join(RAIZ, 'experiment/corridas/bench-logs');
    mkdirSync(logs, { recursive: true });
    for (const app of Object.keys(APPS) as App[]) {
      const log = createWriteStream(join(logs, `${app}.log`));
      const proceso = spawn(process.execPath, [`dist/apps/${app}/main.js`], {
        cwd: RAIZ,
        env: this.variables(app),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      proceso.stdout?.pipe(log);
      proceso.stderr?.pipe(log);
      this.procesos.push(proceso);
    }
    const limite = performance.now() + 90_000;
    while (performance.now() < limite) {
      const sanos = await Promise.all(
        (Object.keys(APPS) as App[]).map((a) =>
          fetch(`${this.url(a)}/health`).then(
            (r) => r.ok,
            () => false,
          ),
        ),
      );
      if (sanos.every(Boolean)) {
        return;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    throw new Error(
      'Los servicios no respondieron /health a tiempo (ver experiment/corridas/bench-logs).',
    );
  }

  async detener(): Promise<void> {
    await Promise.all(
      this.procesos.map(
        (p) =>
          new Promise<void>((listo) => {
            if (p.exitCode !== null) {
              listo();
              return;
            }
            const plazo = setTimeout(() => p.kill('SIGKILL'), 10_000);
            p.once('exit', () => {
              clearTimeout(plazo);
              listo();
            });
            p.kill();
          }),
      ),
    );
  }
}

/** Mide `total` invocaciones EN SERIE de `operacion` con reloj monotono (RM-04, RM-06). */
async function medir(
  nombre: string,
  total: number,
  operacion: () => Promise<void>,
): Promise<{ nombre: string; latencias_ms: number[] }> {
  const latencias: number[] = [];
  for (let i = 0; i < total; i++) {
    const inicio = performance.now();
    await operacion();
    latencias.push(performance.now() - inicio);
  }
  return resumir({ nombre, latencias_ms: latencias });
}

/** Informe de avance en consola; el percentil oficial lo calcula el cuaderno (RM-02). */
function resumir(t: { nombre: string; latencias_ms: number[] }): {
  nombre: string;
  latencias_ms: number[];
} {
  const ordenadas = [...t.latencias_ms].sort((a, b) => a - b);
  const mitad = ordenadas[Math.floor(ordenadas.length / 2)];
  console.log(
    `${t.nombre}: ${ordenadas.length} iteraciones, mediana aproximada ${mitad.toFixed(3)} ms`,
  );
  return t;
}

/** Corre `ruta_completa.py` con el cliente del ejecutor y devuelve sus latencias. */
function rutaCompleta(urlBackend: string, total: number): number[] {
  const r = spawnSync(
    'uv',
    ['run', 'python', 'bench/ruta_completa.py', '--url', urlBackend, '--total', String(total)],
    { cwd: join(RAIZ, 'experiment'), encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    throw new Error(`ruta_completa.py termino con codigo ${r.status}: ${r.stderr}`);
  }
  const latencias = JSON.parse(r.stdout) as unknown;
  if (!Array.isArray(latencias) || latencias.length !== total) {
    throw new Error(`ruta_completa.py no devolvio ${total} latencias.`);
  }
  return latencias as number[];
}

async function main(): Promise<void> {
  const opciones = leerOpciones(process.argv.slice(2));
  const total = opciones.calentamiento + opciones.iteraciones;
  const entorno = new Entorno(opciones.indice);
  process.env['CONOCIMIENTO_DATABASE_URL'] = entorno.urlBd;
  process.env['TICKETS_DATABASE_URL'] = entorno.urlBd;

  console.log(
    `Arrancando mcp-server, b0-directo y b3-a2a-conocimiento (entorno ${opciones.indice})...`,
  );
  await entorno.arrancar();
  const transportes: { nombre: string; latencias_ms: number[] }[] = [];
  try {
    // 1. Adaptador local: el mismo `CapacidadesLocales` que B0 enlaza a su
    //    puerto; `listar()` es su operacion sin trabajo util (sin BD ni auditoria).
    //    El modulo se arma aqui y no al importar: `forRoot()` lee la URL de la
    //    base del entorno, que se fija arriba.
    @Module({ imports: [CapacidadesModule.forRoot()] })
    class ModuloAdaptadorLocal {}
    const contexto = await NestFactory.createApplicationContext(ModuloAdaptadorLocal, {
      logger: ['error', 'warn'],
    });
    const local = contexto.get(CapacidadesLocales);
    transportes.push(
      await medir('adaptador_local', total, async () => {
        await local.listar();
      }),
    );
    await contexto.close();

    // 2. MCP: `ping` del protocolo con el mismo SDK y transporte Streamable HTTP
    //    que `CapacidadesMcp`, sobre UNA sesion reutilizada como hacen los agentes.
    const cliente = new Client({ name: 'bench-transporte', version: '0.1.0' });
    await cliente.connect(
      new StreamableHTTPClientTransport(new URL(RUTA_MCP, `${entorno.url('mcp-server')}/`)),
    );
    transportes.push(
      await medir('mcp_streamable_http', total, async () => {
        await cliente.ping();
      }),
    );
    await cliente.close();

    // 3. A2A: `message/send` con el mismo sobre, cabeceras y cliente HTTP que
    //    `EspecialistasA2a`, pero con un DataPart sin habilidad: el especialista
    //    lo rechaza con -32602 antes de llamar al agente (ni modelo ni MCP).
    const urlA2a = new URL(RUTA_A2A, `${entorno.url('b3-a2a-conocimiento')}/`).toString();
    let n = 0;
    transportes.push(
      await medir('a2a_salto', total, async () => {
        n += 1;
        const respuesta = await fetch(urlA2a, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            [CABECERA_TRACE_ID]: `bench-a2a-${n}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `bench-${n}`,
            method: METODO_A2A_MESSAGE_SEND,
            params: {
              contextId: 'bench-transporte',
              message: {
                role: 'user',
                parts: [{ kind: 'data', data: {} }],
                metadata: { traceId: `bench-a2a-${n}`, hop: 1, emisor: 'orquestador' },
              },
            },
          }),
        });
        const json = (await respuesta.json()) as { error?: { code: number } };
        if (json.error?.code !== CODIGOS_JSONRPC.parametrosInvalidos) {
          throw new Error(`El especialista no respondio -32602: ${JSON.stringify(json)}`);
        }
      }),
    );

    // 4. Ruta completa: `GET /health` del backend de entrada con el MISMO
    //    cliente del ejecutor (httpx en Python), que es quien recorre esta ruta
    //    en la corrida. Se mide en ese proceso y aqui solo se recogen los valores.
    transportes.push({
      nombre: 'ruta_completa_http',
      latencias_ms: rutaCompleta(entorno.url('b0-directo'), total),
    });
    resumir(transportes[transportes.length - 1]);
  } finally {
    await entorno.detener();
  }

  const bench = {
    generado_en: new Date().toISOString(),
    iteraciones_calentamiento: opciones.calentamiento,
    transportes,
  };
  writeFileSync(opciones.salida, `${JSON.stringify(bench)}\n`, 'utf-8');
  console.log(`Escrito ${opciones.salida}`);
}

main().then(
  () => process.exit(0),
  (fallo: unknown) => {
    console.error(fallo);
    process.exit(1);
  },
);
