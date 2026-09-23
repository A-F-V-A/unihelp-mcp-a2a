import {
  ConmutarEstadoInicialController,
  EstadoInicialController,
} from './controladores/estado-inicial.controller';
import { SimulacionModule } from './simulacion.module';

/**
 * `forRoot` lee el perfil del entorno que se le pasa, asi que se puede
 * comprobar sin arrancar NestJS ni tocar PostgreSQL.
 */
function controladores(entorno: Readonly<Record<string, string | undefined>>): unknown[] {
  return [...(SimulacionModule.forRoot(entorno).controllers ?? [])];
}

describe('SimulacionModule', () => {
  it('sin perfil de experimento el simulador queda de solo lectura (HU-36)', () => {
    const registrados = controladores({});

    expect(registrados).toContain(EstadoInicialController);
    expect(registrados).not.toContain(ConmutarEstadoInicialController);
  });

  it('con UNIHELP_PERFIL=experimento se puede conmutar el estado inicial', () => {
    expect(controladores({ UNIHELP_PERFIL: 'experimento' })).toContain(
      ConmutarEstadoInicialController,
    );
  });

  it('nunca se puede conmutar en el perfil de produccion, aunque NODE_ENV diga test', () => {
    const registrados = controladores({ UNIHELP_PERFIL: 'produccion', NODE_ENV: 'test' });

    expect(registrados).not.toContain(ConmutarEstadoInicialController);
  });

  it('registra un controlador por cada sistema emulado, mas el panel', () => {
    // 4 sistemas + panel + estado inicial (lectura) + conmutador.
    expect(controladores({ UNIHELP_PERFIL: 'experimento' })).toHaveLength(7);
  });
});
