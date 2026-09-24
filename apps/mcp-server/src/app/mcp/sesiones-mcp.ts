import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { RegistroCapacidades } from '@unihelp/capacidades';
import { ServidorHerramientasMcp } from './servidor-herramientas-mcp';

/** Cabecera del protocolo con el identificador de sesion (Streamable HTTP). */
const CABECERA_SESION = 'mcp-session-id';

interface Sesion {
  readonly transporte: StreamableHTTPServerTransport;
  readonly servidor: Server;
}

/**
 * Sesiones del transporte Streamable HTTP, una por cliente conectado. El
 * transporte es CON estado a proposito: solo asi el cliente puede abrir el
 * flujo SSE por el que el servidor le avisa `notifications/tools/list_changed`
 * cuando el registro cambia (HU-27). Sin sesion no hay notificaciones.
 */
@Injectable()
export class SesionesMcp implements OnModuleDestroy {
  private readonly logger = new Logger('MCP');
  private readonly sesiones = new Map<string, Sesion>();
  private readonly darseDeBaja: () => void;

  constructor(
    @Inject(ServidorHerramientasMcp) private readonly fabrica: ServidorHerramientasMcp,
    @Inject(RegistroCapacidades) registro: RegistroCapacidades,
  ) {
    this.darseDeBaja = registro.alCambiar(() => {
      void this.notificarCambioDeLista();
    });
  }

  /** Cantidad de sesiones abiertas (solo para pruebas y diagnostico). */
  get abiertas(): number {
    return this.sesiones.size;
  }

  async atender(
    peticion: IncomingMessage,
    respuesta: ServerResponse,
    cuerpo: unknown,
  ): Promise<void> {
    const idSesion = peticion.headers[CABECERA_SESION];
    const id = Array.isArray(idSesion) ? idSesion[0] : idSesion;
    const existente = id === undefined ? undefined : this.sesiones.get(id);

    if (existente !== undefined) {
      await existente.transporte.handleRequest(peticion, respuesta, cuerpo);
      return;
    }
    if (id === undefined && peticion.method === 'POST' && isInitializeRequest(cuerpo)) {
      const sesion = await this.abrir();
      await sesion.transporte.handleRequest(peticion, respuesta, cuerpo);
      return;
    }

    respuesta.writeHead(id === undefined ? 400 : 404, { 'content-type': 'application/json' });
    respuesta.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message:
            id === undefined
              ? 'Petición inválida: falta la sesión MCP y no es una inicialización.'
              : 'La sesión MCP no existe o ya se cerró.',
        },
        id: null,
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.darseDeBaja();
    await Promise.all([...this.sesiones.values()].map((s) => s.transporte.close()));
    this.sesiones.clear();
  }

  private async abrir(): Promise<Sesion> {
    const servidor = this.fabrica.crear();
    const transporte = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        this.sesiones.set(id, { transporte, servidor });
        this.logger.log(`Sesión MCP abierta: ${id}`);
      },
      onsessionclosed: (id) => {
        this.sesiones.delete(id);
        this.logger.log(`Sesión MCP cerrada: ${id}`);
      },
    });
    transporte.onclose = () => {
      const id = transporte.sessionId;
      if (id !== undefined) {
        this.sesiones.delete(id);
      }
    };
    await servidor.connect(transporte);
    return { transporte, servidor };
  }

  /** El registro cambio: todas las sesiones abiertas reciben la notificacion (HU-27). */
  private async notificarCambioDeLista(): Promise<void> {
    for (const [id, sesion] of this.sesiones) {
      try {
        await sesion.servidor.sendToolListChanged();
      } catch (fallo) {
        this.logger.warn(
          `No se pudo notificar el cambio de herramientas a la sesión ${id}: ${
            fallo instanceof Error ? fallo.message : String(fallo)
          }`,
        );
      }
    }
  }
}
