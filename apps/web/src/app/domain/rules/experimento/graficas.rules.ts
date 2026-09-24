import type { IdentificadorArquitectura } from '@unihelp/dominio';
import type {
  FilaMetrica,
  IntervaloConfianza,
  MetricaResultado,
} from '../../models/experimento/resultados-analisis';

/**
 * Da forma a las filas de `resultados.json` para las graficas del panel. Solo
 * SELECCIONA y REORDENA filas ya calculadas: no suma, no promedia ni compara
 * (RM-02). Si una figura necesita un numero que no viene en el archivo, la
 * figura no lo muestra.
 */

export interface PuntoConIntervalo {
  readonly grupo: string;
  readonly arquitectura: IdentificadorArquitectura;
  readonly valor: number | null;
  readonly intervalo: IntervaloConfianza | null;
  readonly nTareas: number | null;
}

/** Orden de los grupos de la figura de efectividad: global y las cuatro categorias. */
export const GRUPOS_EFECTIVIDAD = [
  'global',
  'informativa',
  'diagnostico',
  'compuesta',
  'adversarial',
] as const;

export const COMPONENTES_LATENCIA = [
  'modelo',
  'herramienta',
  'transporte',
  'orquestacion',
] as const;

export type ComponenteLatencia = (typeof COMPONENTES_LATENCIA)[number];

export function buscarMetrica(
  metricas: readonly MetricaResultado[],
  codigo: string,
): MetricaResultado | null {
  return metricas.find((metrica) => metrica.codigo === codigo) ?? null;
}

/**
 * Efectividad con intervalo (HU-MET-11): M1.1 aporta el grupo `global`, M1.2
 * una fila por categoria. Cada punto lleva su intervalo tal cual; si no hay,
 * queda `null` y la grafica lo dice en vez de dibujar un punto suelto.
 */
export function puntosEfectividad(
  global: MetricaResultado | null,
  porCategoria: MetricaResultado | null,
): PuntoConIntervalo[] {
  const puntos: PuntoConIntervalo[] = [];
  for (const fila of global?.filas ?? []) {
    if (fila.arquitectura) {
      puntos.push(punto('global', fila));
    }
  }
  for (const fila of porCategoria?.filas ?? []) {
    const categoria = fila.dimensiones['categoria'];
    if (fila.arquitectura && categoria) {
      puntos.push(punto(categoria, fila));
    }
  }
  return puntos;
}

export interface SegmentoLatencia {
  readonly arquitectura: IdentificadorArquitectura;
  readonly componente: ComponenteLatencia;
  readonly medianaMs: number | null;
  readonly intervalo: IntervaloConfianza | null;
}

export interface BarraLatencia {
  readonly arquitectura: IdentificadorArquitectura;
  readonly segmentos: readonly SegmentoLatencia[];
  /** Mediana de extremo a extremo (M4.1), superpuesta a la pila (HU-MET-12). */
  readonly medianaTotalMs: number | null;
  readonly intervaloTotal: IntervaloConfianza | null;
  /** Porcentaje del residuo de orquestacion, tal como lo evaluo el cuaderno (M4.2 umbral.observado). */
  readonly proporcionResiduo: number | null;
}

/**
 * Barras apiladas de la latencia (HU-MET-12). Los segmentos son las medianas por
 * componente de M4.2 y el marcador es la mediana total de M4.1. El cuaderno
 * advierte que las medianas no son aditivas: por eso la pila NO muestra su suma.
 */
export function barrasLatencia(
  descomposicion: MetricaResultado | null,
  extremoAExtremo: MetricaResultado | null,
  arquitecturas: readonly IdentificadorArquitectura[],
): BarraLatencia[] {
  const observado = descomposicion?.umbral?.observado;
  return arquitecturas.map((arquitectura) => {
    const total = (extremoAExtremo?.filas ?? []).find(
      (fila) => fila.arquitectura === arquitectura && fila.estadistico === 'mediana_entre_tareas',
    );
    return {
      arquitectura,
      segmentos: COMPONENTES_LATENCIA.map((componente) => {
        const fila = (descomposicion?.filas ?? []).find(
          (f) =>
            f.arquitectura === arquitectura &&
            f.dimensiones['componente'] === componente &&
            f.estadistico === 'mediana_entre_tareas',
        );
        return {
          arquitectura,
          componente,
          medianaMs: fila?.valor ?? null,
          intervalo: fila?.intervalo ?? null,
        };
      }),
      medianaTotalMs: total?.valor ?? null,
      intervaloTotal: total?.intervalo ?? null,
      proporcionResiduo:
        observado && typeof observado === 'object' ? (observado[arquitectura] ?? null) : null,
    };
  });
}

/** Filas de una metrica por arquitectura para una dimension concreta (p. ej. tokens=total). */
export function filasPorArquitectura(
  metrica: MetricaResultado | null,
  dimension: string | null,
  valorDimension: string | null,
  estadistico: string | null = null,
): FilaMetrica[] {
  return (metrica?.filas ?? []).filter(
    (fila) =>
      fila.arquitectura !== null &&
      (dimension === null || fila.dimensiones[dimension] === valorDimension) &&
      (estadistico === null || fila.estadistico === estadistico),
  );
}

/** Valores distintos que toma una dimension en las filas de una metrica, en orden de aparicion. */
export function valoresDimension(metrica: MetricaResultado | null, dimension: string): string[] {
  const vistos: string[] = [];
  for (const fila of metrica?.filas ?? []) {
    const valor = fila.dimensiones[dimension];
    if (valor !== undefined && !vistos.includes(valor)) {
      vistos.push(valor);
    }
  }
  return vistos;
}

/** El piso de latencia por transporte (M4.3), que la figura muestra como referencia. */
export interface PisoTransporte {
  readonly transporte: string;
  readonly estadistico: string;
  readonly valorMs: number | null;
}

export function pisoTransporte(piso: MetricaResultado | null): PisoTransporte[] {
  return (piso?.filas ?? [])
    .filter((fila) => fila.dimensiones['transporte'] !== undefined)
    .map((fila) => ({
      transporte: fila.dimensiones['transporte'] ?? '',
      estadistico: fila.estadistico,
      valorMs: fila.valor,
    }));
}

function punto(grupo: string, fila: FilaMetrica): PuntoConIntervalo {
  return {
    grupo,
    arquitectura: fila.arquitectura as IdentificadorArquitectura,
    valor: fila.valor,
    intervalo: fila.intervalo,
    nTareas: fila.nTareas,
  };
}
