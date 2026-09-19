/**
 * Errores de negocio de la base de conocimiento. Cada app los traduce a
 * `ErrorApiDto` por su `codigo`, sin conocer TypeORM. Los fallos de conexion o
 * de SQL no se envuelven: llegan tal cual porque no son de negocio.
 */

export const CODIGOS_ERROR_CONOCIMIENTO = [
  'consulta-invalida',
  'servicio-no-encontrado',
  'categoria-no-encontrada',
  'politica-no-encontrada',
  'restablecimiento-no-permitido',
  'seleccion-estado-invalida',
  'semilla-invalida',
  'estado-inconsistente',
  'configuracion-invalida',
] as const;

export type CodigoErrorConocimiento = (typeof CODIGOS_ERROR_CONOCIMIENTO)[number];

/** Base de todos los errores de la libreria. */
export class ErrorConocimiento extends Error {
  constructor(
    readonly codigo: CodigoErrorConocimiento,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** La consulta no cumple `LONGITUD_CONSULTA_POLITICAS`. */
export class ConsultaInvalidaError extends ErrorConocimiento {
  constructor(detalle: string) {
    super('consulta-invalida', detalle);
  }
}

export class ServicioNoEncontradoError extends ErrorConocimiento {
  constructor(readonly servicioCodigo: string) {
    super('servicio-no-encontrado', `No existe el servicio «${servicioCodigo}».`);
  }
}

export class CategoriaNoEncontradaError extends ErrorConocimiento {
  constructor(readonly categoriaCodigo: string) {
    super('categoria-no-encontrada', `No existe la categoría «${categoriaCodigo}».`);
  }
}

/** No existe la politica, o no existe la version pedida de ella. */
export class PoliticaNoEncontradaError extends ErrorConocimiento {
  constructor(
    readonly politicaCodigo: string,
    readonly version: string | null,
  ) {
    super(
      'politica-no-encontrada',
      version === null
        ? `No existe la política «${politicaCodigo}».`
        : `No existe la versión ${version} de la política «${politicaCodigo}».`,
    );
  }
}

/** El restablecimiento solo existe en el perfil de experimento o de pruebas (HU-36). */
export class RestablecimientoNoPermitidoError extends ErrorConocimiento {
  constructor() {
    super(
      'restablecimiento-no-permitido',
      'El restablecimiento solo está disponible con UNIHELP_PERFIL=experimento o NODE_ENV=test.',
    );
  }
}

/** Se pidio un estado inicial o un corpus que la semilla no define. Nada se escribe. */
export class SeleccionEstadoInvalidaError extends ErrorConocimiento {
  constructor(detalle: string) {
    super('seleccion-estado-invalida', detalle);
  }
}

/** Los datos semilla no respetan su esquema o sus referencias. */
export class SemillaInvalidaError extends ErrorConocimiento {
  constructor(
    readonly ruta: string,
    detalle: string,
  ) {
    super('semilla-invalida', `Semilla inválida en ${ruta}: ${detalle}.`);
  }
}

/**
 * Lo que hay en la base no es lo que se esperaba: una siembra sobre datos
 * ajenos o una escritura que no quedo identica. La transaccion se revierte.
 */
export class EstadoInconsistenteError extends ErrorConocimiento {
  constructor(
    readonly huellaEsperada: string,
    readonly huellaEncontrada: string,
  ) {
    super(
      'estado-inconsistente',
      `La base de conocimiento no coincide con la semilla (esperada ${huellaEsperada}, encontrada ${huellaEncontrada}).`,
    );
  }
}

export class ConfiguracionInvalidaError extends ErrorConocimiento {
  constructor(detalle: string) {
    super('configuracion-invalida', detalle);
  }
}
