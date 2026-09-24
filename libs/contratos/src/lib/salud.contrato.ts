import type {
  AlcanceArquitectura,
  IdentificadorArquitectura,
  ProtocoloIntegracion,
  RolServicio,
} from '@unihelp/dominio';

/**
 * Contrato del endpoint `GET /api/health`, identico en las ocho apps de
 * backend. Permite verificar en cualquier momento QUE arquitectura esta
 * corriendo, sin inspeccionar contenedores ni logs.
 */
export interface RespuestaSalud {
  /** Estado operativo del servicio. */
  readonly estado: 'ok';
  /** Arquitectura a la que pertenece el servicio ('COMPARTIDO' para el MCP). */
  readonly arquitectura: AlcanceArquitectura;
  /** Nombre del proyecto Nx que atiende la peticion. */
  readonly servicio: string;
  /** Rol del servicio dentro de su arquitectura. */
  readonly rol: RolServicio;
  /** Protocolo por el que este servicio alcanza las capacidades del sistema. */
  readonly protocolo: ProtocoloIntegracion;
  /** Descripcion legible, pensada para mostrarse en la UI. */
  readonly descripcion: string;
  /** Arquitecturas que consumen este servicio. */
  readonly consumidoPor: readonly IdentificadorArquitectura[];
  /** Servicios de los que depende para responder (vacio si es autocontenido). */
  readonly dependencias: readonly string[];
  /** Version del artefacto desplegado. */
  readonly version: string;
  /** Instante de la respuesta, en ISO 8601. */
  readonly marcaTiempo: string;
  /** Segundos que lleva vivo el proceso. */
  readonly tiempoActividadSegundos: number;
}

/**
 * Datos estaticos con los que cada app describe su propia identidad. El
 * endpoint de salud los completa en tiempo de ejecucion con marca de tiempo,
 * version y tiempo de actividad.
 */
export type IdentidadServicio = Pick<
  RespuestaSalud,
  | 'arquitectura'
  | 'servicio'
  | 'rol'
  | 'protocolo'
  | 'descripcion'
  | 'consumidoPor'
  | 'dependencias'
>;
