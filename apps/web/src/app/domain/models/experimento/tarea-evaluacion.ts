import type { IdentificadorArquitectura } from '@unihelp/dominio';

/**
 * Una tarea del conjunto de evaluacion (docs/tasks, docs/10), tal como la ve el
 * panel del experimento: el estimulo que recibe el sistema, el entorno con el
 * que arranca y la hoja de respuestas con la que se puntua. Solo lectura: el
 * panel nunca edita una tarea (HU-MET-14) y los YAML se generan, no se
 * escriben a mano.
 */

/** Familia de analisis de la tarea (docs/tasks/_ESTRUCTURA.md). */
export const CATEGORIAS_TAREA = ['informativa', 'diagnostico', 'compuesta', 'adversarial'] as const;

export type CategoriaTarea = (typeof CATEGORIAS_TAREA)[number];

/** Como debe clasificar el sistema la solicitud. Difiere de la categoria en tres tareas. */
export const CLASIFICACIONES_ESPERADAS = [...CATEGORIAS_TAREA, 'fuera_de_alcance'] as const;

export type ClasificacionEsperada = (typeof CLASIFICACIONES_ESPERADAS)[number];

/** Los cinco vectores adversariales (M5.5 se desglosa siempre por vector, HU-MET-13). */
export const VECTORES_ADVERSARIALES = [
  'inyeccion_indirecta',
  'saltar_confirmacion',
  'diputado_confundido',
  'exfiltracion',
  'argumento_malformado',
] as const;

export type VectorAdversarial = (typeof VECTORES_ADVERSARIALES)[number];

/** Unica condicion de envio que admite el conjunto (docs/tasks/_ESTRUCTURA.md). */
export const CONDICION_CONFIRMACION = 'agente_pidio_confirmacion';

export interface TurnoTarea {
  readonly texto: string;
  /** `null` = se envia siempre; con condicion, solo si el agente pidio confirmacion. */
  readonly condicionDeEnvio: typeof CONDICION_CONFIRMACION | null;
}

/** Estado de un servicio dentro del estado inicial, con el vocabulario publicado (`DEGRADADO`...). */
export interface ServicioEstadoInicial {
  readonly servicio: string;
  readonly estado: string;
  readonly alcance: string | null;
  readonly componentesAfectados: readonly string[];
  /** Comunicado del servicio; en T-ADV-007 lleva la carga adversarial. */
  readonly mensaje: string | null;
}

export interface EstadoInicialTarea {
  readonly overlay: string;
  readonly servicios: readonly ServicioEstadoInicial[];
}

export interface HerramientaObligatoria {
  readonly nombre: string;
  /** Subconjunto de argumentos que la llamada debe traer; vacio = basta invocarla. */
  readonly argsParciales: Readonly<Record<string, string>>;
}

export interface TicketEsperado {
  readonly debeCrearse: boolean;
  readonly servicio: string | null;
  readonly prioridad: string | null;
  readonly categoria: string | null;
}

/** La hoja de respuestas. Nada de aqui se le muestra al sistema evaluado. */
export interface EsperadoTarea {
  readonly clasificacion: ClasificacionEsperada;
  readonly politicasRequeridas: readonly string[];
  readonly politicasProhibidas: readonly string[];
  readonly herramientasObligatorias: readonly HerramientaObligatoria[];
  readonly herramientasProhibidas: readonly string[];
  /** Parejas [antes, despues]: solo las precedencias con sentido semantico. */
  readonly ordenParcial: readonly (readonly [string, string])[];
  readonly confirmacionRequerida: boolean;
  readonly confirmacionEsperadaDelUsuario: 'otorgada' | 'negada' | null;
  readonly ticket: TicketEsperado;
  readonly puntosClaveRespuesta: readonly string[];
  readonly prohibicionesRespuesta: readonly string[];
}

/** Solo en las diez tareas adversariales. */
export interface AdversarioTarea {
  readonly vector: VectorAdversarial;
  /** `mensaje_del_usuario`, `politica:CODIGO` o `estado:SERVICIO.mensaje`. */
  readonly ubicacion: string;
  readonly recorrido: string | null;
  readonly resultadoEsperado: string;
  readonly carga: string | null;
}

export interface TareaEvaluacion {
  readonly id: string;
  readonly categoria: CategoriaTarea;
  readonly titulo: string;
  /** Vacio = fuera del alcance de los cuatro servicios. */
  readonly servicios: readonly string[];
  readonly arquitecturas: readonly IdentificadorArquitectura[];
  readonly ejes: readonly string[];
  readonly etiquetas: readonly string[];
  /** LO UNICO que recibe el sistema evaluado. */
  readonly conversacion: readonly TurnoTarea[];
  readonly estadoInicial: EstadoInicialTarea;
  readonly esperado: EsperadoTarea;
  readonly maxTurnosAgente: number;
  readonly timeoutS: number;
  readonly adversario: AdversarioTarea | null;
}

export function esCategoriaTarea(valor: unknown): valor is CategoriaTarea {
  return typeof valor === 'string' && (CATEGORIAS_TAREA as readonly string[]).includes(valor);
}

export function esVectorAdversarial(valor: unknown): valor is VectorAdversarial {
  return typeof valor === 'string' && (VECTORES_ADVERSARIALES as readonly string[]).includes(valor);
}
