import type { ErrorApiDto } from '@unihelp/contratos';
import type { ErrorSimulable } from '../configuracion-simulacion';

/** Cuerpos de error tal como los devolveria la API. El timeout no tiene cuerpo: ocurre en el cliente. */
export const ERRORES_SIMULADOS: Readonly<Record<Exclude<ErrorSimulable, 'timeout'>, ErrorApiDto>> =
  {
    validacion: {
      codigo: 'validacion',
      mensaje:
        'El servidor rechazó la solicitud: el campo «texto» contiene caracteres no permitidos.',
      detalles: { campo: 'texto' },
    },
    'servicio-no-disponible': {
      codigo: 'servicio-no-disponible',
      mensaje:
        'El servicio de triaje no está disponible en este momento. Intenta de nuevo en unos minutos.',
      detalles: { reintentarEnSegundos: 30 },
    },
    interno: {
      codigo: 'interno',
      mensaje: 'El servidor encontró un error inesperado al procesar la solicitud.',
      detalles: { traza: 'sim-500' },
    },
  };

export const MENSAJE_TIMEOUT = 'El servidor tardó demasiado en responder.';
