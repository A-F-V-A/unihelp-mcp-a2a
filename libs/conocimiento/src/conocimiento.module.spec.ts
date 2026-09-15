import { RestablecerConocimientoUseCase } from './aplicacion/restablecer-conocimiento.use-case';
import { BuscarPoliticaUseCase } from './aplicacion/buscar-politica.use-case';
import { ConocimientoModule } from './conocimiento.module';
import { ConfiguracionInvalidaError } from './dominio/errores';

describe('ConocimientoModule.forRoot', () => {
  const url = { CONOCIMIENTO_DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

  it('exporta los casos de uso de lectura en cualquier perfil', () => {
    expect(ConocimientoModule.forRoot({}, url).exports).toContain(BuscarPoliticaUseCase);
  });

  it('no registra el restablecimiento fuera del perfil de experimento o pruebas (HU-36)', () => {
    const modulo = ConocimientoModule.forRoot({}, { ...url, NODE_ENV: 'production' });
    expect(modulo.exports).not.toContain(RestablecerConocimientoUseCase);
    expect(modulo.providers).not.toContain(RestablecerConocimientoUseCase);
  });

  it('registra el restablecimiento con UNIHELP_PERFIL=experimento', () => {
    expect(
      ConocimientoModule.forRoot({}, { ...url, UNIHELP_PERFIL: 'experimento' }).exports,
    ).toContain(RestablecerConocimientoUseCase);
  });

  it('UNIHELP_PERFIL=produccion lo prohibe aunque NODE_ENV sea test', () => {
    expect(
      ConocimientoModule.forRoot({}, { ...url, UNIHELP_PERFIL: 'produccion', NODE_ENV: 'test' })
        .exports,
    ).not.toContain(RestablecerConocimientoUseCase);
  });

  it('falla al arrancar si falta la URL de la base', () => {
    expect(() => ConocimientoModule.forRoot({}, {})).toThrow(ConfiguracionInvalidaError);
  });
});
