/**
 * Entorno de PRODUCCION (imagen Docker que se evalua en el experimento).
 *
 * La URL del backend NO vive aqui: se resuelve en ejecucion desde `config.json`
 * (decision 5). Desde que se retiro la capa de datos simulada, el frontend
 * siempre habla con un backend real (decision 29).
 */
export const environment = {
  production: true,
};
