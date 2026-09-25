import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RUTA_A2A, RUTA_AGENT_CARD } from '@unihelp/contratos';
import { AppModule } from './app/app.module';
import { IDENTIDAD, PUERTO_POR_DEFECTO } from './app/salud/identidad';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // `/health` queda fuera del prefijo para cumplir el contrato de verificacion;
  // `/.well-known/agent-card.json` y `/a2a` son rutas del protocolo A2A v1.0 (HU-29).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: RUTA_AGENT_CARD.slice(1), method: RequestMethod.GET },
      { path: RUTA_A2A.slice(1), method: RequestMethod.ALL },
    ],
  });

  // El frontend Angular corre en otro origen (4200 en dev, 8080 en Docker).
  app.enableCors({ origin: process.env.CORS_ORIGEN ?? '*' });

  const puerto = Number(process.env.PORT ?? PUERTO_POR_DEFECTO);
  await app.listen(puerto, '0.0.0.0');

  Logger.log(
    `[${IDENTIDAD.arquitectura}] ${IDENTIDAD.servicio} escuchando en http://localhost:${puerto} (salud: /health)`,
    'Bootstrap',
  );
}

void bootstrap();
