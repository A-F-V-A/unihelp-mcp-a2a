/**
 * Lee `visor.config.yaml` y las anulaciones por variable de entorno.
 *
 * Un valor invalido detiene el visor con un mensaje claro: nunca se corre con
 * un valor supuesto (mismo criterio que `experiment/ejecutor/configuracion.py`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { ConfiguracionPersona, ConfiguracionVisor } from './tipos';

export const RAIZ_VISOR = resolve(__dirname, '..');
export const RAIZ_EXPERIMENTO = resolve(RAIZ_VISOR, '..');
export const RAIZ_REPOSITORIO = resolve(RAIZ_EXPERIMENTO, '..');
export const RUTA_CONFIG_POR_DEFECTO = resolve(RAIZ_VISOR, 'visor.config.yaml');

const ARQUITECTURAS = ['B0', 'B1', 'B2', 'B3'] as const;
const TRAZAS_PLAYWRIGHT = ['off', 'on', 'retain-on-failure', 'on-first-retry'] as const;
const CONFIRMACIONES = ['texto', 'boton'] as const;

/**
 * Variables de entorno que pisan el archivo. Se listan a mano, y no por un
 * mapeo generico, porque las claves del YAML ya llevan guiones bajos y un
 * `VISOR_PERSONA_PAUSA_LECTURA_MS` seria ambiguo.
 */
export const ANULACIONES_ENTORNO: Readonly<Record<string, string>> = {
  VISOR_CONFIG: 'ruta del archivo de configuracion',
  VISOR_ARQUITECTURA: 'arquitectura',
  VISOR_BACKEND: 'backend',
  VISOR_FRONTEND: 'frontend',
  VISOR_TAREAS: 'tareas (ids separados por coma, admite comodines)',
  VISOR_REPETICIONES: 'repeticiones',
  VISOR_CONFIRMACION: 'persona.confirmacion (texto | boton)',
  VISOR_TECLEO_MS: 'persona.tecleo_ms (minimo,maximo)',
  VISOR_SEMILLA: 'persona.semilla',
  VISOR_RESTABLECER: 'entorno.restablecer (true | false)',
  VISOR_ENVIAR_TRACE_ID: 'entorno.enviar_trace_id (true | false)',
  VISOR_MEDICION: 'medicion.habilitada (true | false)',
  VISOR_COMPUERTA: 'medicion.compuerta (true | false)',
  VISOR_FALLAR_SI_REPRUEBA: 'medicion.fallar_si_reprueba_compuerta (true | false)',
  VISOR_VISIBLE: 'navegador.visible (true | false)',
  VISOR_CAMARA_LENTA_MS: 'navegador.camara_lenta_ms',
  VISOR_PANEL: 'panel.visible (true | false)',
  VISOR_VIDEO: 'salidas.video (true | false)',
  VISOR_NOMBRE: 'nombre del directorio de salidas de la corrida',
};

export class ErrorConfiguracionVisor extends Error {}

type Crudo = Record<string, unknown>;
type Entorno = Readonly<Record<string, string | undefined>>;

function objeto(crudo: unknown, ruta: string): Crudo {
  if (crudo === undefined || crudo === null) {
    return {};
  }
  if (typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new ErrorConfiguracionVisor(`${ruta} debe ser un objeto.`);
  }
  return crudo as Crudo;
}

function texto(crudo: unknown, ruta: string, porDefecto?: string): string {
  if (crudo === undefined || crudo === null) {
    if (porDefecto === undefined) {
      throw new ErrorConfiguracionVisor(`Falta ${ruta}.`);
    }
    return porDefecto;
  }
  if (typeof crudo !== 'string' || crudo.trim() === '') {
    throw new ErrorConfiguracionVisor(`${ruta} debe ser un texto no vacio.`);
  }
  return crudo.trim();
}

function numero(crudo: unknown, ruta: string, porDefecto: number, minimo = 0): number {
  if (crudo === undefined || crudo === null) {
    return porDefecto;
  }
  const valor = typeof crudo === 'string' ? Number(crudo) : crudo;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo) {
    throw new ErrorConfiguracionVisor(
      `${ruta} debe ser un numero >= ${minimo}; llego ${String(crudo)}.`,
    );
  }
  return valor;
}

function booleano(crudo: unknown, ruta: string, porDefecto: boolean): boolean {
  if (crudo === undefined || crudo === null) {
    return porDefecto;
  }
  if (typeof crudo === 'boolean') {
    return crudo;
  }
  if (crudo === 'true' || crudo === 'false') {
    return crudo === 'true';
  }
  throw new ErrorConfiguracionVisor(`${ruta} debe ser true o false; llego ${String(crudo)}.`);
}

function opcion<T extends string>(
  crudo: unknown,
  ruta: string,
  admitidas: readonly T[],
  porDefecto: T,
): T {
  const valor = crudo === undefined || crudo === null ? porDefecto : crudo;
  if (!admitidas.includes(valor as T)) {
    throw new ErrorConfiguracionVisor(
      `${ruta} debe ser ${admitidas.join(' | ')}; llego ${String(crudo)}.`,
    );
  }
  return valor as T;
}

function listaTareas(crudo: unknown, ruta: string): readonly string[] | null {
  if (crudo === undefined || crudo === null || crudo === '') {
    return null;
  }
  const lista: unknown = typeof crudo === 'string' ? crudo.split(',') : crudo;
  if (!Array.isArray(lista) || lista.some((t) => typeof t !== 'string')) {
    throw new ErrorConfiguracionVisor(`${ruta} debe ser una lista de ids (T-COM-001, T-ADV-*).`);
  }
  const limpias = (lista as string[]).map((t) => t.trim()).filter((t) => t !== '');
  return limpias.length === 0 ? null : limpias;
}

function rango(
  crudo: unknown,
  ruta: string,
  porDefecto: readonly [number, number],
): readonly [number, number] {
  if (crudo === undefined || crudo === null) {
    return porDefecto;
  }
  const partes: unknown =
    typeof crudo === 'string' ? crudo.split(',').map((p) => Number(p.trim())) : crudo;
  if (
    !Array.isArray(partes) ||
    partes.length !== 2 ||
    partes.some((p) => typeof p !== 'number' || !Number.isFinite(p) || p < 0) ||
    partes[0] > partes[1]
  ) {
    throw new ErrorConfiguracionVisor(`${ruta} debe ser [minimo, maximo] en milisegundos.`);
  }
  return [partes[0] as number, partes[1] as number];
}

function persona(crudo: Crudo, entorno: Entorno): ConfiguracionPersona {
  const erroresDeTecleo = numero(crudo['errores_de_tecleo'], 'persona.errores_de_tecleo', 0);
  if (erroresDeTecleo > 1) {
    throw new ErrorConfiguracionVisor('persona.errores_de_tecleo es una probabilidad entre 0 y 1.');
  }
  return {
    tecleoMs: rango(
      entorno['VISOR_TECLEO_MS'] ?? crudo['tecleo_ms'],
      'persona.tecleo_ms',
      [35, 110],
    ),
    erroresDeTecleo,
    pausaAntesDeEscribirMs: numero(
      crudo['pausa_antes_de_escribir_ms'],
      'persona.pausa_antes_de_escribir_ms',
      800,
    ),
    pausaLecturaMs: numero(crudo['pausa_lectura_ms'], 'persona.pausa_lectura_ms', 1500),
    pausaLecturaPorCaracterMs: numero(
      crudo['pausa_lectura_por_caracter_ms'],
      'persona.pausa_lectura_por_caracter_ms',
      8,
    ),
    pausaLecturaMaximaMs: numero(
      crudo['pausa_lectura_maxima_ms'],
      'persona.pausa_lectura_maxima_ms',
      9000,
    ),
    confirmacion: opcion(
      entorno['VISOR_CONFIRMACION'] ?? crudo['confirmacion'],
      'persona.confirmacion',
      CONFIRMACIONES,
      'texto',
    ),
    pausaFinalMs: numero(crudo['pausa_final_ms'], 'persona.pausa_final_ms', 3000),
    semilla: Math.trunc(
      numero(entorno['VISOR_SEMILLA'] ?? crudo['semilla'], 'persona.semilla', 20261014),
    ),
  };
}

/** Interpreta un documento YAML ya leido. Separado de la lectura para poder probarlo. */
export function interpretarConfiguracion(
  documento: unknown,
  entorno: Entorno = process.env,
  raiz: string = RAIZ_VISOR,
): ConfiguracionVisor {
  const crudo = objeto(documento, 'la configuracion');
  const entornoCrudo = objeto(crudo['entorno'], 'entorno');
  const medicion = objeto(crudo['medicion'], 'medicion');
  const navegador = objeto(crudo['navegador'], 'navegador');
  const panel = objeto(crudo['panel'], 'panel');
  const salidas = objeto(crudo['salidas'], 'salidas');

  return {
    arquitectura: opcion(
      entorno['VISOR_ARQUITECTURA'] ?? crudo['arquitectura'],
      'arquitectura',
      ARQUITECTURAS,
      'B0',
    ),
    backend: texto(entorno['VISOR_BACKEND'] ?? crudo['backend'], 'backend').replace(/\/+$/, ''),
    frontend: texto(entorno['VISOR_FRONTEND'] ?? crudo['frontend'], 'frontend').replace(/\/+$/, ''),
    tareas: listaTareas(entorno['VISOR_TAREAS'] ?? crudo['tareas'], 'tareas'),
    repeticiones: Math.trunc(
      numero(entorno['VISOR_REPETICIONES'] ?? crudo['repeticiones'], 'repeticiones', 1, 1),
    ),
    persona: persona(objeto(crudo['persona'], 'persona'), entorno),
    entorno: {
      restablecer: booleano(
        entorno['VISOR_RESTABLECER'] ?? entornoCrudo['restablecer'],
        'entorno.restablecer',
        true,
      ),
      verificarHuella: booleano(entornoCrudo['verificar_huella'], 'entorno.verificar_huella', true),
      enviarTraceId: booleano(
        entorno['VISOR_ENVIAR_TRACE_ID'] ?? entornoCrudo['enviar_trace_id'],
        'entorno.enviar_trace_id',
        true,
      ),
    },
    medicion: {
      habilitada: booleano(
        entorno['VISOR_MEDICION'] ?? medicion['habilitada'],
        'medicion.habilitada',
        true,
      ),
      compuerta: booleano(
        entorno['VISOR_COMPUERTA'] ?? medicion['compuerta'],
        'medicion.compuerta',
        true,
      ),
      fallarSiRepruebaCompuerta: booleano(
        entorno['VISOR_FALLAR_SI_REPRUEBA'] ?? medicion['fallar_si_reprueba_compuerta'],
        'medicion.fallar_si_reprueba_compuerta',
        false,
      ),
    },
    navegador: {
      ancho: Math.trunc(numero(navegador['ancho'], 'navegador.ancho', 1480, 400)),
      alto: Math.trunc(numero(navegador['alto'], 'navegador.alto', 900, 400)),
      visible: booleano(
        entorno['VISOR_VISIBLE'] ?? navegador['visible'],
        'navegador.visible',
        true,
      ),
      camaraLentaMs: numero(
        entorno['VISOR_CAMARA_LENTA_MS'] ?? navegador['camara_lenta_ms'],
        'navegador.camara_lenta_ms',
        0,
      ),
    },
    panel: {
      visible: booleano(entorno['VISOR_PANEL'] ?? panel['visible'], 'panel.visible', true),
      ancho: Math.trunc(numero(panel['ancho'], 'panel.ancho', 420, 240)),
    },
    tiempoMaximoTurnoS: numero(crudo['tiempo_maximo_turno_s'], 'tiempo_maximo_turno_s', 150, 1),
    salidas: {
      directorio: resolve(raiz, texto(salidas['directorio'], 'salidas.directorio', 'salidas')),
      video: booleano(entorno['VISOR_VIDEO'] ?? salidas['video'], 'salidas.video', false),
      trazaPlaywright: opcion(
        salidas['traza_playwright'],
        'salidas.traza_playwright',
        TRAZAS_PLAYWRIGHT,
        'retain-on-failure',
      ),
    },
  };
}

export function cargarConfiguracion(entorno: Entorno = process.env): ConfiguracionVisor {
  const ruta = resolve(RAIZ_VISOR, entorno['VISOR_CONFIG'] ?? RUTA_CONFIG_POR_DEFECTO);
  if (!existsSync(ruta)) {
    throw new ErrorConfiguracionVisor(`No existe la configuracion del visor: ${ruta}`);
  }
  return interpretarConfiguracion(parse(readFileSync(ruta, 'utf8')), entorno);
}

/** Nombre del directorio de una corrida del visor: el que pida el entorno o una marca de tiempo. */
export function nombreCorrida(entorno: Entorno = process.env, ahora: Date = new Date()): string {
  const pedido = entorno['VISOR_NOMBRE']?.trim();
  if (pedido) {
    return pedido.replace(/[^A-Za-z0-9._-]/g, '_');
  }
  return `visor-${ahora
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}`;
}
