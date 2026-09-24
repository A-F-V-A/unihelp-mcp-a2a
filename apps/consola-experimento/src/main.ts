import './entorno';
import { resolve } from 'node:path';
import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { IDENTIDAD, PUERTO_POR_DEFECTO } from './app/salud/identidad';

/**
 * Archivos del experimento que el panel lee tal cual (decision 38). En
 * desarrollo el servidor de Angular reenvia `/datos-experimento` aqui, para
 * que sus assets no incluyan `experiment/` y el dev server no recargue la
 * pagina con cada traza que escribe el ejecutor (decision 39). Solo lectura.
 */
// `corrida.yaml` se sirve solo, desde `ConsolaController`, para no exponer el codigo Python.
const DATOS_EXPERIMENTO: readonly (readonly [string, string])[] = [
  ['/datos-experimento/tareas', 'docs/tasks'],
  ['/datos-experimento/salidas', 'experiment/salidas'],
  ['/datos-experimento/corridas', 'experiment/corridas'],
];

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // `/health`, `/consola/*` y `/datos-experimento/*` viven fuera del prefijo
  // `/api`: ese prefijo es el contrato de triaje que atiende el frontend contra
  // B0-B3 (decisiones 6 y 32) y la consola no forma parte de el.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'consola/(.*)', method: RequestMethod.ALL },
      { path: 'datos-experimento/(.*)', method: RequestMethod.ALL },
    ],
  });

  // El panel corre en otro origen (4200 en desarrollo).
  app.enableCors({ origin: process.env.CORS_ORIGEN ?? '*' });

  const raiz = resolve(process.cwd(), process.env.UNIHELP_RAIZ_REPOSITORIO ?? '.');
  for (const [ruta, directorio] of DATOS_EXPERIMENTO) {
    // Solo los archivos de datos, sin listados; `express.static` responde 404 a lo
    // que no existe y valida por ETag, asi el panel siempre lee la version en disco.
    app.useStaticAssets(resolve(raiz, directorio), {
      prefix: ruta,
      index: false,
      dotfiles: 'ignore',
    });
  }

  const puerto = Number(process.env.PORT ?? PUERTO_POR_DEFECTO);
  // Solo en la maquina local: la consola lanza procesos del sistema y no debe
  // quedar expuesta a la red.
  await app.listen(puerto, process.env.CONSOLA_INTERFAZ ?? '127.0.0.1');

  Logger.log(
    `[${IDENTIDAD.arquitectura}] ${IDENTIDAD.servicio} escuchando en http://localhost:${puerto} (salud: /health, estado: /consola/estado, datos: /datos-experimento)`,
    'Bootstrap',
  );
}

void bootstrap();
