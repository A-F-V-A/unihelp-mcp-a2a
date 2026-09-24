/**
 * Lee las 40 tareas de `docs/tasks/` con las mismas reglas que
 * `experiment/ejecutor/tareas.py`: orden por id, turnos solo de la persona,
 * corpus adversarial solo cuando la carga vive en una politica. Si las dos
 * lecturas divergieran, el visor y el ejecutor estarian corriendo tareas
 * distintas sin que nadie lo note.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { RAIZ_EXPERIMENTO, RAIZ_REPOSITORIO } from './configuracion';
import type { EsperadoResumen, TareaVisor, TurnoTarea } from './tipos';

export const DIRECTORIO_TAREAS = resolve(RAIZ_REPOSITORIO, 'docs', 'tasks');
export const RUTA_HUELLAS_VARIANTES = resolve(
  RAIZ_EXPERIMENTO,
  'ejecutor',
  'huellas-variantes.json',
);

const PATRON_ID = /^T-(INF|DIA|COM|ADV)-[0-9]{3}$/;
const CONDICION_CONFIRMACION = 'agente_pidio_confirmacion';

export class ErrorTareas extends Error {}

type Crudo = Record<string, unknown>;

function lista(valor: unknown): readonly string[] {
  return Array.isArray(valor) ? valor.map((v) => String(v)) : [];
}

function nombresDeHerramientas(valor: unknown): readonly string[] {
  if (!Array.isArray(valor)) {
    return [];
  }
  return valor.map((h: unknown) =>
    typeof h === 'object' && h !== null ? String((h as Crudo)['nombre']) : String(h),
  );
}

function turnos(crudo: unknown, id: string): readonly TurnoTarea[] {
  if (!Array.isArray(crudo) || crudo.length === 0) {
    throw new ErrorTareas(`${id}: no tiene ningun turno de la persona.`);
  }
  return crudo.map((bruto: Crudo) => {
    if (bruto['rol'] !== 'usuario') {
      throw new ErrorTareas(`${id}: la conversacion solo admite turnos de la persona.`);
    }
    const condicion = bruto['condicion_de_envio'];
    if (condicion !== undefined && condicion !== null && condicion !== CONDICION_CONFIRMACION) {
      throw new ErrorTareas(`${id}: condicion_de_envio desconocida «${String(condicion)}».`);
    }
    return {
      texto: String(bruto['texto']),
      condicionDeEnvio: condicion === CONDICION_CONFIRMACION ? CONDICION_CONFIRMACION : null,
    };
  });
}

function esperado(crudo: Crudo): EsperadoResumen {
  const confirmacion = (crudo['confirmacion'] ?? {}) as Crudo;
  const ticket = (crudo['ticket'] ?? {}) as Crudo;
  return {
    clasificacion: String(crudo['clasificacion'] ?? ''),
    herramientasObligatorias: nombresDeHerramientas(crudo['herramientas_obligatorias']),
    herramientasProhibidas: nombresDeHerramientas(crudo['herramientas_prohibidas']),
    politicasRequeridas: lista(crudo['politicas_requeridas']),
    confirmacionRequerida: confirmacion['requerida'] === true,
    ticketDebeCrearse: ticket['debe_crearse'] === true,
  };
}

export function interpretarTarea(documento: unknown, origen: string): TareaVisor {
  const crudo = (documento ?? {}) as Crudo;
  const id = String(crudo['id'] ?? '');
  if (!PATRON_ID.test(id)) {
    throw new ErrorTareas(`${origen}: el id «${id}» no tiene la forma T-XXX-000.`);
  }
  const estadoInicial = (crudo['estado_inicial'] ?? {}) as Crudo;
  const overlay = estadoInicial['overlay'];
  if (typeof overlay !== 'string' || overlay === '') {
    throw new ErrorTareas(`${id}: falta estado_inicial.overlay.`);
  }
  const adversario = (crudo['adversario'] ?? null) as Crudo | null;
  const ubicacion = String(adversario?.['ubicacion'] ?? '');
  return {
    id,
    categoria: String(crudo['categoria']),
    titulo: String(crudo['titulo']),
    arquitecturas: lista(crudo['arquitecturas']),
    overlay,
    // Solo las tareas cuya carga vive en una politica necesitan el corpus envenenado
    // (docs/base-de-conocimiento.md, seccion 5); igual que `Tarea.corpus` en Python.
    corpus: ubicacion.startsWith('politica:') ? 'adversarial' : 'estandar',
    turnos: turnos(crudo['conversacion'], id),
    esperado: esperado((crudo['esperado'] ?? {}) as Crudo),
    maxTurnosAgente: Number(crudo['max_turnos_agente'] ?? 8),
    timeoutS: Number(crudo['timeout_s'] ?? 120),
    vectorAdversarial: adversario ? String(adversario['vector'] ?? '') || null : null,
  };
}

export function cargarTareas(directorio: string = DIRECTORIO_TAREAS): readonly TareaVisor[] {
  const archivos = readdirSync(directorio)
    .filter((nombre) => /^T-.*\.yaml$/.test(nombre))
    .sort();
  if (archivos.length === 0) {
    throw new ErrorTareas(`No hay tareas en ${directorio}.`);
  }
  return archivos
    .map((nombre) =>
      interpretarTarea(parse(readFileSync(resolve(directorio, nombre), 'utf8')), nombre),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Filtra por ids con comodin (`T-ADV-*`), como `--tareas` del ejecutor. `null` = todas. */
export function seleccionarTareas(
  tareas: readonly TareaVisor[],
  patrones: readonly string[] | null,
): readonly TareaVisor[] {
  if (patrones === null) {
    return tareas;
  }
  const expresiones = patrones.map(
    (p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`),
  );
  const seleccion = tareas.filter((t) => expresiones.some((e) => e.test(t.id)));
  if (seleccion.length === 0) {
    throw new ErrorTareas(`Ninguna tarea coincide con ${patrones.join(', ')}.`);
  }
  return seleccion;
}

/** Huella esperada por (estado inicial, corpus), desde el cache que regenera `ejecutor huellas`. */
export function huellasPorVariante(
  ruta: string = RUTA_HUELLAS_VARIANTES,
): ReadonlyMap<string, string> {
  if (!existsSync(ruta)) {
    throw new ErrorTareas(
      `Falta ${ruta}. Regenerarlo con: cd experiment && uv run python -m ejecutor huellas`,
    );
  }
  const datos = JSON.parse(readFileSync(ruta, 'utf8')) as {
    variantes: readonly { estadoInicial: string; corpus: string; huella: string }[];
  };
  return new Map(datos.variantes.map((v) => [`${v.estadoInicial}|${v.corpus}`, v.huella]));
}

export function huellaEsperada(
  tarea: TareaVisor,
  variantes: ReadonlyMap<string, string>,
): string | null {
  return variantes.get(`${tarea.overlay}|${tarea.corpus}`) ?? null;
}
