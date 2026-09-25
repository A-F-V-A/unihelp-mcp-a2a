import { Inject, Injectable } from '@nestjs/common';
import { CapacidadesMcp } from '@unihelp/capacidades-mcp';
import type { MedicionReceptorDto } from '@unihelp/contratos';
import { META_A2A } from '@unihelp/contratos';
import type { ProtocoloIntegracion } from '@unihelp/dominio';
import {
  type ContextoInvocacion,
  type DelegacionRegistrada,
  type DescripcionCapacidad,
  ErrorHerramienta,
  ErrorInfraestructura,
  type PuertoCapacidades,
  type ResultadoInvocacion,
  envolverContenidoRecuperado,
  marcadorDeEjecucion,
} from '@unihelp/herramientas';
import Ajv, { type ValidateFunction } from 'ajv';
import {
  DEFINICIONES_HABILIDADES,
  type DefinicionHabilidad,
  definicionHabilidadDe,
  descripcionesHabilidades,
} from '../habilidades/definiciones-habilidades';
import { PUERTO_ESPECIALISTAS, type PuertoEspecialistas } from './puerto-especialistas';

/** `a2a` en B3, `en-proceso` en B2: el transporte con el que se firma cada delegacion en la traza. */
export const PROTOCOLO_DELEGACION = Symbol('PROTOCOLO_DELEGACION');

/**
 * Puerto de capacidades del orquestador de B2 y B3 (decision 44). Para el
 * nucleo es un `PuertoCapacidades` mas; por dentro reparte: las dos habilidades
 * de delegacion van al puerto de especialistas (en proceso o A2A) y las tres
 * herramientas de tickets van al servidor MCP con `X-Agent-Id: orquestador`
 * (HU-20). Asi el modelo del orquestador ve CINCO herramientas, como el agente
 * unico, y la unica diferencia entre B2 y B3 es la implementacion de
 * `PuertoEspecialistas`.
 *
 * Una delegacion vuelve al bucle con `delegacion` para que el instrumentador la
 * registre como salto y fusione lo que el especialista midio (HU-34, M4.5).
 */
@Injectable()
export class CapacidadesOrquestador implements PuertoCapacidades {
  private readonly validadores = new Map<string, ValidateFunction>();

  constructor(
    @Inject(PUERTO_ESPECIALISTAS) private readonly especialistas: PuertoEspecialistas,
    @Inject(CapacidadesMcp) private readonly mcp: CapacidadesMcp,
    @Inject(PROTOCOLO_DELEGACION) private readonly protocolo: ProtocoloIntegracion,
  ) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    for (const definicion of DEFINICIONES_HABILIDADES) {
      this.validadores.set(definicion.nombre, ajv.compile(definicion.esquemaEntrada));
    }
  }

  async listar(): Promise<readonly DescripcionCapacidad[]> {
    return [...descripcionesHabilidades(), ...(await this.mcp.listar())];
  }

  async invocar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
  ): Promise<ResultadoInvocacion> {
    const definicion = definicionHabilidadDe(nombre);
    if (definicion === undefined) {
      // Herramienta de tickets: viaja por MCP aunque el agente delegue por otro protocolo.
      return { ...(await this.mcp.invocar(nombre, argumentos, contexto)), transporte: 'mcp' };
    }
    // La validacion de la delegacion ocurre aqui, del lado del emisor, porque no
    // hay receptor MCP que la haga; el codigo es el mismo que el del receptor.
    const validar = this.validadores.get(definicion.nombre);
    if (validar !== undefined && !validar(argumentos)) {
      const detalles = (validar.errors ?? [])
        .map((e) =>
          `${e.instancePath.replace(/^\//, '') || 'los argumentos'} ${e.message ?? ''}`.trim(),
        )
        .join('; ');
      return {
        ok: false,
        error: new ErrorHerramienta(
          'VALIDACION_ENTRADA',
          `Argumentos inválidos para ${nombre}: ${detalles}. Solo se admiten ${Object.keys(
            (definicion.esquemaEntrada as { properties: object }).properties,
          ).join(', ')}.`,
        ),
        durMs: 0,
        rttMs: 0,
      };
    }

    const r = await this.especialistas.delegar({
      habilidad: definicion.nombre,
      entrada: argumentos as Record<string, unknown>,
      traceId: contexto.traceId,
      conversacionId: contexto.conversacionId,
      tiempoRestanteMs: contexto.tiempoRestanteMs ?? null,
    });
    const medicion = r.tarea.metadata?.[META_A2A.medicion] as MedicionReceptorDto | undefined;
    if (medicion === undefined) {
      // Sin la medicion del receptor no hay resta posible (D5): la traza no se
      // puede armar y la ejecucion no cuenta como fallo de la arquitectura.
      throw new ErrorInfraestructura(
        `El especialista de ${definicion.especialista} respondió sin su medición.`,
      );
    }
    const delegacion: DelegacionRegistrada = {
      salto: {
        de: 'orquestador',
        a: definicion.especialista,
        habilidad: definicion.nombre,
        task_id: r.tarea.id,
        estado: r.tarea.status,
        t_emision: r.tEmision,
        t_recepcion: r.tRecepcion,
        rtt_ms: r.rttMs,
        procesamiento_receptor_ms: medicion.duracion_ms,
      },
      medicion,
      artefactos: r.tarea.artifacts.map((a) => a.artifactId),
      transporte: this.protocolo,
    };

    const artefacto = r.tarea.artifacts.find((a) => a.artifactId === definicion.artefacto);
    const parte = artefacto?.parts.find((p) => p.kind === 'data');
    const dato = parte && 'data' in parte ? parte.data : undefined;
    if (r.tarea.status !== 'completed' || dato === undefined) {
      const motivo = r.tarea.metadata?.[META_A2A.motivo];
      return {
        ok: false,
        error: new ErrorHerramienta(
          'SERVICIO_NO_DISPONIBLE',
          `El especialista de ${definicion.especialista} no pudo completar la solicitud: ${
            typeof motivo === 'string' ? motivo : 'sin motivo declarado.'
          }`,
        ),
        durMs: medicion.duracion_ms,
        rttMs: r.rttMs,
        delegacion,
      };
    }
    return {
      ok: true,
      salida: {
        paraModelo: paraElModelo(definicion, dato, contexto.traceId),
        estructurado: dato,
      },
      durMs: medicion.duracion_ms,
      rttMs: r.rttMs,
      delegacion,
    };
  }
}

/**
 * El artefacto tal como lo ve el modelo del orquestador. Los extractos que trae
 * `politica_aplicable` son contenido recuperado de la base y viajan otra vez
 * entre marcadores de la ejecucion, como en `buscar_politica` (HU-18, capa 2):
 * el especialista los copio literalmente y sin marcadores, y el orquestador no
 * debe leerlos como instrucciones.
 */
function paraElModelo(definicion: DefinicionHabilidad, dato: unknown, traceId: string): unknown {
  if (definicion.artefacto !== 'politica_aplicable') {
    return dato;
  }
  const marcador = marcadorDeEjecucion(traceId);
  const artefacto = dato as {
    politicas?: readonly { codigo: string; version: string; extracto: string }[];
  };
  return {
    ...artefacto,
    politicas: (artefacto.politicas ?? []).map((p) => ({
      ...p,
      extracto: envolverContenidoRecuperado(
        { origen: `política ${p.codigo} v${p.version}`, texto: p.extracto },
        marcador,
      ),
    })),
  };
}
