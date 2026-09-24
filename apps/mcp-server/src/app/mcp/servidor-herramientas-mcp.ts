import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  type CallToolResult,
  CallToolRequestSchema,
  type IsomorphicHeaders,
  LATEST_PROTOCOL_VERSION,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Inject, Injectable } from '@nestjs/common';
import { comoTrasViajar, InvocadorCapacidades, RegistroCapacidades } from '@unihelp/capacidades';
import {
  CABECERA_TRACE_ID,
  type ContextoMcpDto,
  type ErrorHerramientaMcpDto,
  META_MCP,
  SERVIDOR_MCP,
} from '@unihelp/contratos';
import {
  type ContextoInvocacion,
  type DefinicionHerramienta,
  type ResultadoCapacidad,
  ahoraMonotonoMs,
} from '@unihelp/herramientas';

/**
 * Version de la especificacion MCP que implementa el SDK instalado
 * (`@modelcontextprotocol/sdk` 1.30.1). Se registra en la documentacion de B1 y
 * se anuncia en el arranque para que una actualizacion del SDK no pase callada.
 */
export const VERSION_ESPECIFICACION_MCP = LATEST_PROTOCOL_VERSION;

/**
 * Una definicion del contrato compartido, tal como MCP la publica en
 * `tools/list`: esquemas de entrada y salida (HU-25) y anotaciones (HU-26),
 * derivados de `@unihelp/herramientas`, nunca reescritos aqui.
 */
export function aHerramientaMcp(definicion: DefinicionHerramienta): Tool {
  return {
    name: definicion.nombre,
    title: definicion.titulo,
    description: definicion.descripcion,
    inputSchema: definicion.esquemaEntrada as Tool['inputSchema'],
    outputSchema: definicion.esquemaSalida as Tool['outputSchema'],
    annotations: { title: definicion.titulo, ...definicion.anotaciones },
  };
}

function cabecera(cabeceras: IsomorphicHeaders | undefined, nombre: string): string | null {
  const valor = cabeceras?.[nombre] ?? cabeceras?.[nombre.toLowerCase()];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  const limpio = texto?.trim();
  return limpio ? limpio : null;
}

/**
 * Reconstruye en el receptor el contexto de la invocacion: la traza viaja en la
 * cabecera HTTP (HU-33) y el resto en `_meta` de la peticion. Si un cliente que
 * no es un agente de UniHelp omite algo (por ejemplo, el inspector de MCP), se
 * usa un valor derivado de la sesion: la auditoria nunca queda sin actor ni sin
 * traza (RM-09).
 */
export function contextoDeLlamada(
  meta: Record<string, unknown> | undefined,
  cabeceras: IsomorphicHeaders | undefined,
  sesion: string | undefined,
): ContextoInvocacion {
  const porDefecto = `mcp-sesion-${sesion ?? 'anonima'}`;
  const contexto = (meta?.[META_MCP.contexto] ?? {}) as Partial<ContextoMcpDto>;
  return {
    traceId: cabecera(cabeceras, CABECERA_TRACE_ID) ?? porDefecto,
    conversacionId:
      typeof contexto.conversacionId === 'string' && contexto.conversacionId !== ''
        ? contexto.conversacionId
        : porDefecto,
    actor:
      typeof contexto.actor === 'string' && contexto.actor !== '' ? contexto.actor : 'cliente-mcp',
  };
}

/**
 * Traduce el resultado del receptor al `CallToolResult` de MCP. El texto que ve
 * el modelo es el MISMO JSON que B0 pone en el rol de herramienta; el resultado
 * estructurado va en `structuredContent` (validado por el cliente contra
 * `outputSchema`) y lo que no es para el modelo va en `_meta`: la duracion del
 * manejador (D5) y el dato sin sanear para la traza (M3.1). Un error de negocio
 * vuelve con `isError` y su codigo identificable (M2.6), nunca como error del
 * protocolo: el modelo debe poder verlo y corregir.
 */
export function aResultadoMcp(resultado: ResultadoCapacidad, duracionMs: number): CallToolResult {
  if (!resultado.ok) {
    const error: ErrorHerramientaMcpDto = {
      codigo: resultado.error.codigo,
      mensaje: resultado.error.message,
    };
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ error }) }],
      _meta: { [META_MCP.duracionMs]: duracionMs, [META_MCP.error]: error },
    };
  }
  const paraModelo = comoTrasViajar(resultado.salida.paraModelo) as Record<string, unknown>;
  return {
    content: [{ type: 'text', text: JSON.stringify(paraModelo) }],
    structuredContent: paraModelo,
    _meta: {
      [META_MCP.duracionMs]: duracionMs,
      [META_MCP.estructurado]: comoTrasViajar(resultado.salida.estructurado),
    },
  };
}

/**
 * Construye un servidor MCP (uno por sesion) sobre el registro y el invocador
 * compartidos. Se usa el `Server` de bajo nivel y no `McpServer` porque este
 * ultimo solo acepta esquemas Zod: publicar los JSON Schema del contrato tal
 * cual es lo que garantiza que B0 y B1 entregan al modelo lo mismo (RNF-01).
 *
 * `tools.listChanged: true` no es decorativo: es lo que permite que una
 * herramienta agregada al registro aparezca en el agente sin reiniciarlo (HU-27).
 */
@Injectable()
export class ServidorHerramientasMcp {
  constructor(
    @Inject(RegistroCapacidades) private readonly registro: RegistroCapacidades,
    @Inject(InvocadorCapacidades) private readonly invocador: InvocadorCapacidades,
  ) {}

  crear(): Server {
    const servidor = new Server(SERVIDOR_MCP, {
      capabilities: { tools: { listChanged: true } },
    });

    servidor.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.registro.definiciones.map(aHerramientaMcp),
    }));

    servidor.setRequestHandler(CallToolRequestSchema, async (peticion, extra) => {
      // Desde la entrada al manejador hasta su salida, con reloj monotono (D5, D6).
      const inicio = ahoraMonotonoMs();
      const contexto = contextoDeLlamada(
        peticion.params._meta,
        extra.requestInfo?.headers,
        extra.sessionId,
      );
      const resultado = await this.invocador.invocar(
        peticion.params.name,
        peticion.params.arguments ?? {},
        contexto,
      );
      return aResultadoMcp(resultado, ahoraMonotonoMs() - inicio);
    });

    return servidor;
  }
}
