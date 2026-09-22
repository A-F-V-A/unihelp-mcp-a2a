import { ErrorHerramienta } from './errores-herramienta';
import { ahoraMonotonoMs } from './reloj-monotono';
import type { ValidadorArgumentos } from './validador-argumentos';

/** Maximo de llamadas a herramientas por ejecucion (RNF-04; docs/02, 5). */
export const LIMITE_LLAMADAS_POR_DEFECTO = 20;

/** En nombre de quien y en que ejecucion se invoca una capacidad. */
export interface ContextoInvocacion {
  readonly traceId: string;
  readonly conversacionId: string;
  /** Va al registro de auditoria. Ej.: `b0-agent`. */
  readonly actor: string;
}

/**
 * Puerto del registro de auditoria. Lo cumple `RegistroAuditoria` de
 * `@unihelp/tickets`; se declara aqui para no acoplar esta libreria a aquella.
 */
export interface RegistradorAuditoria {
  registrar(solicitud: {
    readonly traceId: string;
    readonly actor: string;
    readonly accion: string;
    readonly recurso: string;
    readonly resultado: 'OK' | 'RECHAZADO' | 'ERROR';
    readonly motivo?: string | null;
    readonly cuerpo: unknown;
  }): Promise<void>;
}

/** Lo que devuelve el manejador: lo que ve el modelo y el dato sin sanear para la traza. */
export interface SalidaCapacidad {
  /** Salida segun el esquema de la herramienta, con el contenido recuperado ya delimitado. */
  readonly paraModelo: unknown;
  /** El mismo resultado sin delimitar: lo usan la traza (M3.1) y el ensamblado de la respuesta. */
  readonly estructurado: unknown;
}

export type ManejadorCapacidad = (
  argumentos: Record<string, unknown>,
  contexto: ContextoInvocacion,
) => Promise<SalidaCapacidad>;

export type ResultadoCapacidad =
  | { readonly ok: true; readonly salida: SalidaCapacidad; readonly durMs: number }
  | { readonly ok: false; readonly error: ErrorHerramienta; readonly durMs: number };

/**
 * Puerta de entrada del RECEPTOR de una herramienta: valida los argumentos,
 * cuenta la llamada contra el limite, mide la duracion del manejador y audita la
 * invocacion. Es el mismo codigo en B0 (adaptadores locales) y en `mcp-server`
 * (manejadores MCP), para que `tool_exec_ms` y los errores sean iguales en ambos
 * (M4.2, RNF-01). Nunca lanza: todo fallo vuelve como error tipado.
 */
export class EjecutorCapacidad {
  private readonly llamadas = new Map<string, number>();

  constructor(
    private readonly validador: ValidadorArgumentos,
    private readonly auditoria: RegistradorAuditoria,
    private readonly limiteLlamadas: number = LIMITE_LLAMADAS_POR_DEFECTO,
    private readonly traducirFallo: (fallo: unknown) => ErrorHerramienta = traducirFalloPorDefecto,
  ) {}

  async ejecutar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
    manejador: ManejadorCapacidad,
  ): Promise<ResultadoCapacidad> {
    const inicio = ahoraMonotonoMs();
    const duracion = () => ahoraMonotonoMs() - inicio;

    const cuenta = (this.llamadas.get(contexto.traceId) ?? 0) + 1;
    this.llamadas.set(contexto.traceId, cuenta);
    if (cuenta > this.limiteLlamadas) {
      const error = new ErrorHerramienta(
        'LIMITE_EXCEDIDO',
        `Se superó el máximo de ${this.limiteLlamadas} llamadas a herramientas en esta conversación.`,
      );
      await this.auditar(nombre, argumentos, contexto, 'RECHAZADO', error.message);
      return { ok: false, error, durMs: duracion() };
    }

    const validacion = this.validador.validar(nombre, argumentos);
    if (!validacion.valido) {
      const error = new ErrorHerramienta('VALIDACION_ENTRADA', validacion.mensaje);
      await this.auditar(nombre, argumentos, contexto, 'RECHAZADO', error.message);
      return { ok: false, error, durMs: duracion() };
    }

    try {
      const salida = await manejador(argumentos as Record<string, unknown>, contexto);
      await this.auditar(nombre, argumentos, contexto, 'OK', null);
      return { ok: true, salida, durMs: duracion() };
    } catch (fallo) {
      const error = this.traducirFallo(fallo);
      const resultado = error.codigo === 'SERVICIO_NO_DISPONIBLE' ? 'ERROR' : 'RECHAZADO';
      await this.auditar(nombre, argumentos, contexto, resultado, error.message);
      return { ok: false, error, durMs: duracion() };
    }
  }

  /** Olvida el conteo de una ejecucion terminada. */
  olvidar(traceId: string): void {
    this.llamadas.delete(traceId);
  }

  private async auditar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
    resultado: 'OK' | 'RECHAZADO' | 'ERROR',
    motivo: string | null,
  ): Promise<void> {
    await this.auditoria.registrar({
      traceId: contexto.traceId,
      actor: contexto.actor,
      accion: `herramienta.${nombre}`,
      recurso: nombre,
      resultado,
      motivo,
      cuerpo: argumentos,
    });
  }
}

function traducirFalloPorDefecto(fallo: unknown): ErrorHerramienta {
  if (fallo instanceof ErrorHerramienta) {
    return fallo;
  }
  return new ErrorHerramienta(
    'SERVICIO_NO_DISPONIBLE',
    'El servicio de datos no respondió; no se obtuvo resultado.',
  );
}
