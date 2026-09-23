import './entorno';
import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { IDENTIDAD, PUERTO_POR_DEFECTO } from './app/salud/identidad';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Ni `/health` ni `/simulacion/*` llevan el prefijo `/api`: ese prefijo es
  // exactamente el contrato de triaje que declara `libs/contratos` para el
  // frontend (decisiones 6 y 32), y el simulador no forma parte de el. Se deja
  // el prefijo configurado igual que en las demas apps para que agregar una
  // ruta de API mas adelante no cambie las que ya existen.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'simulacion/(.*)', method: RequestMethod.ALL },
    ],
  });

  // El frontend Angular corre en otro origen (4200 en dev, 8080 en Docker).
  app.enableCors({ origin: process.env.CORS_ORIGEN ?? '*' });

  const puerto = Number(process.env.PORT ?? PUERTO_POR_DEFECTO);
  await app.listen(puerto, '0.0.0.0');

  Logger.log(
    `[${IDENTIDAD.arquitectura}] ${IDENTIDAD.servicio} escuchando en http://localhost:${puerto} (salud: /health, sistemas: /simulacion/salud)`,
    'Bootstrap',
  );
}

void bootstrap();
