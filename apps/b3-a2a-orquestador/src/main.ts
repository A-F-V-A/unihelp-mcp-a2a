import './entorno';
import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RUTA_A2A, RUTA_AGENT_CARD } from '@unihelp/contratos';
import { AppModule } from './app/app.module';
import { IDENTIDAD, PUERTO_POR_DEFECTO } from './app/salud/identidad';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Identico a B0/B1: `/health` fuera del prefijo por el contrato de verificacion
  // (decision 6) y `/experimento/*` tambien (decision 32). Fuera quedan ademas
  // `/.well-known/agent-card.json` y `/a2a`, que son rutas del protocolo A2A (HU-29).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'experimento/*ruta', method: RequestMethod.ALL },
      { path: RUTA_AGENT_CARD.slice(1), method: RequestMethod.GET },
      { path: RUTA_A2A.slice(1), method: RequestMethod.ALL },
    ],
  });

  // El frontend Angular corre en otro origen (4200 en dev, 8080 en Docker).
  app.enableCors({ origin: process.env.CORS_ORIGEN ?? '*' });

  const puerto = Number(process.env.PORT ?? PUERTO_POR_DEFECTO);
  await app.listen(puerto, '0.0.0.0');

  Logger.log(
    `[${IDENTIDAD.arquitectura}] ${IDENTIDAD.servicio} escuchando en http://localhost:${puerto} ` +
      `(salud: /health, A2A: ${RUTA_A2A}, servidor MCP: ${process.env.MCP_SERVER_URL ?? 'sin configurar'})`,
    'Bootstrap',
  );
}

void bootstrap();
