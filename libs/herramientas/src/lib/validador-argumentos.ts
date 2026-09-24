import Ajv from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { DEFINICIONES_HERRAMIENTAS, type DefinicionHerramienta } from './definiciones-herramientas';

/** Resultado de validar los argumentos de una llamada. */
export type ResultadoValidacionArgumentos =
  { readonly valido: true } | { readonly valido: false; readonly mensaje: string };

function describir(error: ErrorObject): string {
  const campo = error.instancePath === '' ? 'los argumentos' : `«${error.instancePath.slice(1)}»`;
  const p = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case 'required':
      return `falta el argumento obligatorio «${String(p['missingProperty'])}»`;
    case 'additionalProperties':
      return `el argumento «${String(p['additionalProperty'])}» no existe en esta herramienta`;
    case 'enum':
      return `${campo} debe ser uno de: ${(p['allowedValues'] as unknown[]).join(', ')}`;
    case 'minLength':
      return `${campo} debe tener al menos ${String(p['limit'])} caracteres`;
    case 'maxLength':
      return `${campo} debe tener como máximo ${String(p['limit'])} caracteres`;
    case 'minimum':
    case 'maximum':
      return `${campo} está fuera del rango permitido (${String(p['comparison'])} ${String(p['limit'])})`;
    case 'type':
      return `${campo} debe ser de tipo ${String(p['type'])}`;
    case 'format':
      return `${campo} no tiene el formato ${String(p['format'])}`;
    default:
      return `${campo} no es válido (${error.keyword})`;
  }
}

/**
 * Valida los argumentos contra el esquema de entrada de la herramienta, del lado
 * del receptor, igual que `mcp-server` en B1 (docs/02, 5). Un argumento invalido
 * produce `VALIDACION_ENTRADA` y nunca toca los datos (HU-22, M2.3).
 */
export class ValidadorArgumentos {
  private readonly ajv: Ajv;
  private readonly validadores = new Map<string, ValidateFunction>();

  /** Por defecto conoce las cinco herramientas del contrato. */
  constructor(definiciones: readonly DefinicionHerramienta[] = DEFINICIONES_HERRAMIENTAS) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    for (const definicion of definiciones) {
      this.registrar(definicion);
    }
  }

  /**
   * Compila el esquema de una herramienta agregada despues de arrancar. Es lo
   * que permite que el registro de herramientas crezca de forma aditiva sin
   * recompilar (HU-27): la herramienta nueva se valida igual que las cinco.
   */
  registrar(definicion: DefinicionHerramienta): void {
    this.validadores.set(definicion.nombre, this.ajv.compile(definicion.esquemaEntrada));
  }

  validar(nombre: string, argumentos: unknown): ResultadoValidacionArgumentos {
    const validar = this.validadores.get(nombre);
    if (validar === undefined) {
      return { valido: false, mensaje: `La herramienta «${nombre}» no existe.` };
    }
    if (validar(argumentos)) {
      return { valido: true };
    }
    const detalles = (validar.errors ?? []).map(describir);
    return {
      valido: false,
      mensaje: `Argumentos inválidos para ${nombre}: ${[...new Set(detalles)].join('; ')}.`,
    };
  }
}
