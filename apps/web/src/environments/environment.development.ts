import type { ConfiguracionSimulacion } from '../app/infrastructure/mock/configuracion-simulacion';

/**
 * Entorno de DESARROLLO (`nx serve web`).
 *
 * Mientras el backend no exista, se trabaja contra datos simulados. Cuando
 * alguna arquitectura implemente el contrato de `@unihelp/contratos`, basta con
 * cambiar esta linea a `false`, o levantar `nx serve web -c backend-real`.
 */
export const environment = {
  production: false,
  USE_MOCK_BACKEND: true,
  simulacion: {
    latenciaMinimaMs: 300,
    latenciaMaximaMs: 1500,
    probabilidadError: 0,
    turnosMaximos: 8,
  } as Partial<ConfiguracionSimulacion>,
};
