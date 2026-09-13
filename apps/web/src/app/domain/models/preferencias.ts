/** Preferencias del solicitante: quien es y como quiere ver la aplicacion. */

export const TEMAS = ['sistema', 'claro', 'oscuro'] as const;
export type Tema = (typeof TEMAS)[number];

export const TAMANOS_TEXTO = ['normal', 'grande'] as const;
export type TamanoTexto = (typeof TAMANOS_TEXTO)[number];

export const ROLES_SOLICITANTE = ['estudiante', 'docente', 'administrativo', 'egresado'] as const;
export type RolSolicitante = (typeof ROLES_SOLICITANTE)[number];

export interface PerfilSolicitante {
  readonly nombre: string;
  /** Correo institucional; vacio si no se ha indicado. */
  readonly correo: string;
  readonly rol: RolSolicitante;
}

export interface Preferencias {
  readonly perfil: PerfilSolicitante;
  readonly tema: Tema;
  readonly tamanoTexto: TamanoTexto;
}

export const LONGITUD_MAXIMA_NOMBRE = 60;

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  perfil: { nombre: '', correo: '', rol: 'estudiante' },
  tema: 'sistema',
  tamanoTexto: 'normal',
};

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function incluye<T extends string>(opciones: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (opciones as readonly string[]).includes(valor);
}

function comoRegistro(valor: unknown): Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : {};
}

/**
 * Reconstruye preferencias validas a partir de datos guardados que pueden
 * venir incompletos, de una version anterior o corruptos.
 */
export function normalizarPreferencias(valor: unknown): Preferencias {
  const crudo = comoRegistro(valor);
  const perfil = comoRegistro(crudo['perfil']);
  const base = PREFERENCIAS_POR_DEFECTO;

  const tema = crudo['tema'];
  const tamanoTexto = crudo['tamanoTexto'];
  const nombre = perfil['nombre'];
  const correo = perfil['correo'];
  const rol = perfil['rol'];

  return {
    perfil: {
      nombre:
        typeof nombre === 'string' ? nombre.slice(0, LONGITUD_MAXIMA_NOMBRE) : base.perfil.nombre,
      correo: typeof correo === 'string' ? correo : base.perfil.correo,
      rol: incluye(ROLES_SOLICITANTE, rol) ? rol : base.perfil.rol,
    },
    tema: incluye(TEMAS, tema) ? tema : base.tema,
    tamanoTexto: incluye(TAMANOS_TEXTO, tamanoTexto) ? tamanoTexto : base.tamanoTexto,
  };
}

export type CampoPerfil = 'nombre' | 'correo';

export type ValidacionPerfil =
  | { readonly valido: true; readonly perfil: PerfilSolicitante }
  | { readonly valido: false; readonly errores: Readonly<Partial<Record<CampoPerfil, string>>> };

/** Limpia el perfil y valida sus campos. El nombre y el correo son opcionales. */
export function validarPerfil(perfil: PerfilSolicitante): ValidacionPerfil {
  const nombre = perfil.nombre.trim().replace(/\s+/g, ' ');
  const correo = perfil.correo.trim().toLowerCase();
  const errores: Partial<Record<CampoPerfil, string>> = {};

  if (nombre.length > LONGITUD_MAXIMA_NOMBRE) {
    errores.nombre = `Usa como máximo ${LONGITUD_MAXIMA_NOMBRE} caracteres.`;
  }
  if (correo && !CORREO_VALIDO.test(correo)) {
    errores.correo = 'Escribe un correo válido, por ejemplo nombre@universidad.edu.co.';
  }

  return Object.keys(errores).length > 0
    ? { valido: false, errores }
    : { valido: true, perfil: { nombre, correo, rol: perfil.rol } };
}

/** Iniciales para el avatar: primera letra del primer y del ultimo nombre. */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return '';
  }
  const primera = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (primera + ultima).toUpperCase();
}
