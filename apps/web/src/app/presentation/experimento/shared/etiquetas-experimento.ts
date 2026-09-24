import type { IdentificadorArquitectura } from '@unihelp/dominio';
import type { EstadoEjecucion } from '../../../domain/models/experimento/corrida';
import type {
  EstadoMetrica,
  IntervaloConfianza,
  RolMetrica,
} from '../../../domain/models/experimento/resultados-analisis';
import type {
  CategoriaTarea,
  VectorAdversarial,
} from '../../../domain/models/experimento/tarea-evaluacion';
import type { VeredictoEjecucion } from '../../../domain/rules/experimento/ejecuciones.rules';
import type { ComponenteLatencia } from '../../../domain/rules/experimento/graficas.rules';
import type { EstadoSemaforo } from '../../../domain/rules/experimento/semaforo.rules';

/** Textos visibles del panel. Aqui si llevan tildes: los lee una persona (RM-11). */

export const ETIQUETA_CATEGORIA: Readonly<Record<CategoriaTarea, string>> = {
  informativa: 'Informativa',
  diagnostico: 'Diagnóstico',
  compuesta: 'Compuesta',
  adversarial: 'Adversarial',
};

export const ETIQUETA_CLASIFICACION: Readonly<Record<string, string>> = {
  ...ETIQUETA_CATEGORIA,
  fuera_de_alcance: 'Fuera de alcance',
};

export const ETIQUETA_VECTOR: Readonly<Record<VectorAdversarial, string>> = {
  inyeccion_indirecta: 'Inyección indirecta',
  saltar_confirmacion: 'Saltar la confirmación',
  diputado_confundido: 'Diputado confundido',
  exfiltracion: 'Exfiltración',
  argumento_malformado: 'Argumento malformado',
};

export const ETIQUETA_SERVICIO: Readonly<Record<string, string>> = {
  aula_virtual: 'Aula virtual',
  correo_institucional: 'Correo institucional',
  autenticacion: 'Autenticación',
  matricula: 'Matrícula',
  ninguno: 'Fuera de alcance',
};

export const ETIQUETA_EJE: Readonly<Record<string, string>> = {
  caso_directo: 'Caso directo',
  distractor_cercano: 'Distractor cercano',
  informacion_ausente: 'Información ausente',
  mantenimiento: 'Mantenimiento',
  confirmacion_otorgada: 'Confirmación otorgada',
  confirmacion_negada: 'Confirmación negada',
  multi_servicio: 'Multiservicio',
  ...ETIQUETA_VECTOR,
};

export const ETIQUETA_ESTADO_EJECUCION: Readonly<Record<EstadoEjecucion, string>> = {
  ok: 'Terminó bien',
  timeout: 'Tiempo agotado',
  limite_herramientas: 'Límite de herramientas',
  error_agente: 'Error del agente',
  error_infraestructura: 'Error de infraestructura',
  esquema_invalido: 'Esquema inválido',
};

export const ETIQUETA_VEREDICTO: Readonly<Record<VeredictoEjecucion, string>> = {
  aprobada: 'Superó la compuerta',
  reprobada: 'No superó la compuerta',
  cuarentena: 'En cuarentena',
  infraestructura: 'Fallo de infraestructura',
};

export const ETIQUETA_VEREDICTO_CORTA: Readonly<Record<VeredictoEjecucion, string>> = {
  aprobada: 'Superó',
  reprobada: 'No superó',
  cuarentena: 'Cuarentena',
  infraestructura: 'Infraestructura',
};

export const ETIQUETA_SEMAFORO: Readonly<Record<EstadoSemaforo, string>> = {
  alcanza: 'Alcanza el umbral',
  no_alcanza: 'No alcanza el umbral',
  sin_datos: 'Sin datos en esta corrida',
  pendiente: 'Métrica pendiente',
  no_evaluable: 'No se pudo evaluar',
};

export const ETIQUETA_ESTADO_METRICA: Readonly<Record<EstadoMetrica, string>> = {
  calculada: 'Calculada',
  sin_datos: 'Sin datos',
  pendiente: 'Pendiente',
};

export const ETIQUETA_ROL: Readonly<Record<RolMetrica, string>> = {
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  descriptiva: 'Descriptiva',
  control: 'Control',
};

export const ETIQUETA_COMPONENTE: Readonly<Record<ComponenteLatencia, string>> = {
  modelo: 'Modelo',
  herramienta: 'Herramienta',
  transporte: 'Transporte',
  orquestacion: 'Orquestación',
};

export const ETIQUETA_FAMILIA: Readonly<Record<string, string>> = {
  M1: 'Efectividad',
  M2: 'Uso de herramientas',
  M3: 'Calidad de la respuesta',
  M4: 'Eficiencia y costo',
  M5: 'Seguridad',
  M6: 'Mantenibilidad',
  M7: 'Fiabilidad del experimento',
};

/** Colores de las graficas: una variable por arquitectura, orden fijo (skill dataviz). */
export const COLOR_ARQUITECTURA: Readonly<Record<IdentificadorArquitectura, string>> = {
  B0: 'var(--serie-b0)',
  B1: 'var(--serie-b1)',
  B2: 'var(--serie-b2)',
  B3: 'var(--serie-b3)',
};

/** Los cuatro componentes de la latencia usan las mismas cuatro ranuras: nunca hay mas de cuatro series. */
export const COLOR_COMPONENTE: Readonly<Record<ComponenteLatencia, string>> = {
  modelo: 'var(--serie-b0)',
  herramienta: 'var(--serie-b1)',
  transporte: 'var(--serie-b2)',
  orquestacion: 'var(--serie-b3)',
};

const LOCALE = 'es-CO';
const entero = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimales = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const porcentaje = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 });
const fechaHora = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

export function formatearEntero(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : entero.format(valor);
}

export function formatearDecimal(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : decimales.format(valor);
}

export function formatearPorcentaje(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : porcentaje.format(valor);
}

/** Milisegundos legibles: por debajo de un segundo en ms, por encima en segundos. */
export function formatearMs(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '—';
  }
  return valor >= 1000 ? `${decimales.format(valor / 1000)} s` : `${entero.format(valor)} ms`;
}

export function formatearFechaHora(valor: Date | null | undefined): string {
  return valor ? fechaHora.format(valor) : '—';
}

/** `[0,25; 0,55]` con el nivel del intervalo; nunca se muestra una tasa sin el (HU-MET-11). */
export function formatearIntervalo(
  intervalo: IntervaloConfianza | null,
  como: 'porcentaje' | 'decimal' | 'ms' = 'decimal',
): string {
  if (!intervalo) {
    return 'sin intervalo';
  }
  const f =
    como === 'porcentaje' ? formatearPorcentaje : como === 'ms' ? formatearMs : formatearDecimal;
  return `IC ${Math.round(intervalo.nivel * 100)} %: ${f(intervalo.inferior)} a ${f(intervalo.superior)}`;
}

/** Los primeros caracteres de una huella `sha256:...`, para que quepa en una ficha. */
export function huellaCorta(huella: string | null | undefined): string {
  if (!huella) {
    return '—';
  }
  const sinPrefijo = huella.replace(/^sha256:/, '');
  return `${sinPrefijo.slice(0, 12)}…`;
}

export function etiquetaCategoria(valor: string): string {
  return ETIQUETA_CLASIFICACION[valor] ?? valor;
}

export function etiquetaServicio(valor: string): string {
  return ETIQUETA_SERVICIO[valor] ?? valor.replace(/_/g, ' ');
}

export function etiquetaEje(valor: string): string {
  return ETIQUETA_EJE[valor] ?? valor.replace(/_/g, ' ');
}

export function claseArquitectura(arquitectura: string): string {
  return `chip chip--arq chip--${arquitectura.toLowerCase()}`;
}
