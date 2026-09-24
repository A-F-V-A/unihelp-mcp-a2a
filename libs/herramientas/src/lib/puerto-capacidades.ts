import type { EsquemaJson } from './definiciones-herramientas';
import type { ContextoInvocacion, ResultadoCapacidad } from './ejecutor-capacidad';

/**
 * Lo que el nucleo del agente necesita saber de una capacidad para ofrecersela
 * al modelo: nombre, descripcion y esquema de entrada. Es neutral respecto del
 * proveedor; el nucleo lo traduce al formato de function calling en UN solo
 * lugar, para que B0 y B1 envien al modelo exactamente los mismos bytes (RNF-01).
 */
export interface DescripcionCapacidad {
  readonly nombre: string;
  readonly descripcion: string;
  readonly esquemaEntrada: EsquemaJson;
}

/**
 * Resultado de una invocacion visto desde el EMISOR: lo que devolvio el receptor
 * mas la ida y vuelta medida por quien invoco. `transport_ms = rttMs - durMs`
 * (D5): el receptor reporta su propia duracion y el emisor nunca resta marcas de
 * tiempo de otro proceso (RM-05).
 */
export type ResultadoInvocacion = ResultadoCapacidad & { readonly rttMs: number };

/**
 * Puerto de capacidades del agente unico (HU-25). Es la UNICA frontera entre el
 * nucleo compartido y la variable que el experimento mide: en B0 lo cumple una
 * clase del mismo proceso y en B1 un cliente MCP. El nucleo no conoce ninguna
 * implementacion concreta.
 */
export interface PuertoCapacidades {
  /**
   * Capacidades disponibles en este momento. En B1 salen de `tools/list` y
   * pueden cambiar sin reiniciar el proceso (HU-27); el nucleo las vuelve a
   * pedir antes de cada llamada al modelo.
   */
  listar(): Promise<readonly DescripcionCapacidad[]>;
  /**
   * Invoca una capacidad por nombre. Nunca lanza por un fallo de negocio: eso
   * vuelve como error tipado. SI lanza `ErrorInfraestructura` cuando el receptor
   * no responde, porque la ejecucion debe terminar como `error_infraestructura`
   * y nunca con una respuesta inventada (RM-15).
   */
  invocar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
  ): Promise<ResultadoInvocacion>;
}

/** Token de inyeccion del puerto. Cada arquitectura enlaza su implementacion. */
export const PUERTO_CAPACIDADES = Symbol('PUERTO_CAPACIDADES');
