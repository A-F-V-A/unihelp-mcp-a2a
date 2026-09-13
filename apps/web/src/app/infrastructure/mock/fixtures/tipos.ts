import type { ClasificacionDto, EstadoServicioDto } from '@unihelp/contratos';
import type { AreaServicio, EstadoIncidente, Prioridad } from '@unihelp/dominio';

/**
 * Tipos de las fixtures. Describen DATOS, no comportamiento: para agregar un
 * caso de prueba basta con agregar un objeto a la fixture correspondiente.
 */

/**
 * Estado de servicio con tiempos RELATIVOS a "ahora", para que una ventana
 * estimada nunca quede en el pasado sin importar cuando se ejecute la app.
 */
export interface EstadoServicioFixture extends Omit<
  EstadoServicioDto,
  'ventanaEstimada' | 'actualizadoEn'
> {
  /** Minutos desde ahora (negativo = en el pasado). `null` = sin ventana estimada. */
  readonly ventanaRelativaMin: { readonly inicio: number; readonly fin: number } | null;
  readonly actualizadoHaceMin: number;
}

export type IdCanalAtencion = 'seguridad-campus' | 'atencion-general' | 'restaurante-universitario';

/** Bloque de respuesta expresado por referencia a otras fixtures. */
export type BloqueEscenario =
  | { readonly tipo: 'texto'; readonly texto: string }
  | { readonly tipo: 'politicas'; readonly codigos: readonly string[] }
  | { readonly tipo: 'estado-servicio'; readonly servicio: AreaServicio }
  | { readonly tipo: 'aviso-mantenimiento'; readonly servicio: AreaServicio }
  | { readonly tipo: 'fuera-de-alcance'; readonly motivo: string; readonly canal: IdCanalAtencion };

/** Datos con los que el backend simulado arma una propuesta de ticket. */
export interface BorradorPropuesta {
  readonly servicio: AreaServicio;
  readonly categoria: string;
  readonly prioridad: Prioridad;
  readonly resumen: string;
  /** Estado con el que nace el ticket si se confirma. */
  readonly estadoInicialTicket: EstadoIncidente;
  readonly atencionEstimada: string | null;
}

export interface EscenarioConversacion {
  readonly id: string;
  /** Como se refiere el asistente al tema en mensajes de seguimiento. */
  readonly tema: string;
  /**
   * Palabras o frases (en minuscula y sin tildes) que activan el escenario.
   * Gana el escenario con mas coincidencias; en empate, el primero declarado.
   */
  readonly palabrasClave: readonly string[];
  readonly clasificacion: ClasificacionDto;
  readonly bloques: readonly BloqueEscenario[];
  /** Si no es `null`, el backend sugiere proponer un ticket. */
  readonly propuesta: BorradorPropuesta | null;
  /** `false` para respuestas "meta" que no deben reemplazar el tema en curso. */
  readonly fijaContexto: boolean;
}
