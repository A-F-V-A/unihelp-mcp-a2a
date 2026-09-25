import {
  CaseteModelo,
  ClienteModelo,
  type ConfiguracionAgente,
  identidadAgenteDe,
} from '@unihelp/agente-nucleo';
import { CapacidadesMcp, type FabricaTransporteMcp } from '@unihelp/capacidades-mcp';
import type { IdentidadServicio } from '@unihelp/contratos';
import { promptDeEspecialista } from '../prompts/prompts-especialistas';
import type { RolEspecialista } from '../roles';
import { AgenteEspecialista } from './agente-especialista';

export interface OpcionesEspecialista {
  readonly rol: RolEspecialista;
  /** Identidad de salud de la app que lo aloja (su propio servicio en B3; la de B2 en B2). */
  readonly identidad: IdentidadServicio;
  readonly configuracion: ConfiguracionAgente;
  readonly urlServidorMcp: string;
  /** Solo pruebas: transporte MCP en memoria. */
  readonly fabricaTransporte?: FabricaTransporteMcp | null;
}

/**
 * Arma un especialista completo: su propio cliente del modelo con casetes, su
 * cliente MCP con el rol en `X-Agent-Id` y el prompt de su rol. Es la MISMA
 * construccion en B2 (dos especialistas en el proceso del orquestador) y en B3
 * (uno por servicio): cada agente tiene su cliente del modelo y su sesion MCP,
 * tambien cuando comparten proceso, para que B3 - B2 no incluya una diferencia
 * en como los agentes alcanzan el modelo o las herramientas (RNF-01).
 */
export function crearAgenteEspecialista(opciones: OpcionesEspecialista): AgenteEspecialista {
  const { rol, configuracion } = opciones;
  const casete = new CaseteModelo(configuracion);
  const modelo = new ClienteModelo(configuracion, casete);
  const capacidades = new CapacidadesMcp(
    {
      urlServidorMcp: opciones.urlServidorMcp,
      agente: rol,
      nombreCliente: `${opciones.identidad.servicio}/${rol}`,
    },
    opciones.fabricaTransporte ?? null,
  );
  const identidad = identidadAgenteDe(opciones.identidad, { nombre: rol, protocolo: 'mcp' });
  return new AgenteEspecialista(
    rol,
    identidad,
    promptDeEspecialista(rol),
    modelo,
    capacidades,
    configuracion,
    () => capacidades.onModuleDestroy(),
  );
}
