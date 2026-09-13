import type { ConfiguracionSimulacion } from '../app/infrastructure/mock/configuracion-simulacion';

/**
 * Entorno de PRODUCCION (imagen Docker que se evalua en el experimento).
 *
 * Usa siempre el backend real: una imagen que respondiera con datos simulados
 * contaminaria las mediciones sin que nadie lo notara. Para desarrollo local
 * se reemplaza por `environment.development.ts` (ver `project.json`).
 */
export const environment = {
  production: true,
  USE_MOCK_BACKEND: false,
  simulacion: {} as Partial<ConfiguracionSimulacion>,
};
