/**
 * Identificadores de las cuatro arquitecturas de integracion de agentes que el
 * experimento compara. Son el eje de la variable independiente del estudio.
 */
export const IDENTIFICADORES_ARQUITECTURA = ['B0', 'B1', 'B2', 'B3'] as const;

export type IdentificadorArquitectura = (typeof IDENTIFICADORES_ARQUITECTURA)[number];

/**
 * Alcance que declara un servicio en su endpoint de salud. El servidor MCP es
 * transversal: lo consumen B1, B2 y B3, por lo que no pertenece a una sola
 * arquitectura.
 */
export type AlcanceArquitectura = IdentificadorArquitectura | 'COMPARTIDO';

/** Protocolo por el que un agente alcanza las capacidades del sistema. */
export type ProtocoloIntegracion =
  /** B0: llamada directa a la API, sin protocolo intermedio. */
  | 'directo'
  /** B1: capacidades expuestas como herramientas de un servidor MCP. */
  | 'mcp'
  /** B2: varios agentes coordinados en memoria, dentro del mismo proceso. */
  | 'en-proceso'
  /** B3: agentes como servicios independientes que hablan Agent2Agent. */
  | 'a2a';

/** Rol que cumple un servicio dentro de su arquitectura. */
export type RolServicio = 'agente-unico' | 'orquestador' | 'especialista' | 'servidor-herramientas';

/** Ficha descriptiva de una arquitectura, usada por la UI y por los reportes. */
export interface DescriptorArquitectura {
  readonly id: IdentificadorArquitectura;
  readonly nombre: string;
  readonly protocolo: ProtocoloIntegracion;
  readonly multiagente: boolean;
  readonly distribuida: boolean;
  readonly descripcion: string;
}

export const CATALOGO_ARQUITECTURAS: Readonly<
  Record<IdentificadorArquitectura, DescriptorArquitectura>
> = {
  B0: {
    id: 'B0',
    nombre: 'Agente unico con integracion directa',
    protocolo: 'directo',
    multiagente: false,
    distribuida: false,
    descripcion:
      'Un solo agente invoca la API del dominio directamente. Linea base sin protocolo de integracion.',
  },
  B1: {
    id: 'B1',
    nombre: 'Agente unico sobre MCP',
    protocolo: 'mcp',
    multiagente: false,
    distribuida: false,
    descripcion:
      'Un solo agente consume las mismas capacidades expuestas como herramientas por un servidor MCP.',
  },
  B2: {
    id: 'B2',
    nombre: 'Multiagente local',
    protocolo: 'en-proceso',
    multiagente: true,
    distribuida: false,
    descripcion:
      'Varios agentes especializados se coordinan en el mismo proceso, sin protocolo de red entre ellos.',
  },
  B3: {
    id: 'B3',
    nombre: 'Multiagente distribuido sobre A2A',
    protocolo: 'a2a',
    multiagente: true,
    distribuida: true,
    descripcion:
      'Cada agente especializado es un servicio independiente y se coordina con los demas via protocolo Agent2Agent.',
  },
};

/** Type guard para validar un identificador recibido desde configuracion o red. */
export function esIdentificadorArquitectura(valor: unknown): valor is IdentificadorArquitectura {
  return (
    typeof valor === 'string' && (IDENTIFICADORES_ARQUITECTURA as readonly string[]).includes(valor)
  );
}
