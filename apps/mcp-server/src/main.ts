import './entorno';
import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RUTA_MCP } from '@unihelp/contratos';
import { AppModule } from './app/app.module';
import { VERSION_ESPECIFICACION_MCP } from './app/mcp/servidor-herramientas-mcp';
import { IDENTIDAD, PUERTO_POR_DEFECTO } from './app/salud/identidad';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // `/health` queda fuera del prefijo para cumplir el contrato de verificacion
  // (decision 6) y `/mcp` tambien: es el transporte del protocolo, no una ruta
  // de la API de triaje que declara `libs/contratos` bajo `/api` (docs/02).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: RUTA_MCP.slice(1), method: RequestMethod.ALL },
    ],
  });

  // El frontend Angular corre en otro origen (4200 en dev, 8080 en Docker).
  app.enableCors({ origin: process.env.CORS_ORIGEN ?? '*' });

  const puerto = Number(process.env.PORT ?? PUERTO_POR_DEFECTO);
  await app.listen(puerto, '0.0.0.0');

  Logger.log(
    `[${IDENTIDAD.arquitectura}] ${IDENTIDAD.servicio} escuchando en http://localhost:${puerto} ` +
      `(salud: /health, MCP ${VERSION_ESPECIFICACION_MCP}: ${RUTA_MCP})`,
    'Bootstrap',
  );
}

void bootstrap();
