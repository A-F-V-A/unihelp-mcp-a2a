import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Body, Controller, Get, Header, HttpCode, Param, Post, Sse } from '@nestjs/common';
import type {
  EstadoConsolaDto,
  EventoTrabajoDto,
  LanzarAnalisisDto,
  LanzarCorridaDto,
  TrabajoDto,
} from '@unihelp/contratos';
import { type Observable, map } from 'rxjs';
import { ErrorApi } from '../http/error-api';
import { TrabajosService } from './trabajos.service';

/** Rutas de `RUTAS_CONSOLA`, fuera del prefijo `/api` (ver `main.ts`). */
@Controller()
export class ConsolaController {
  constructor(private readonly trabajos: TrabajosService) {}

  /**
   * La configuracion del ejecutor, tal como esta en disco, para el panel. Se
   * sirve sola (y no todo `experiment/ejecutor/`) para no exponer codigo Python.
   */
  @Get('datos-experimento/ejecutor/corrida.yaml')
  @Header('Content-Type', 'text/yaml; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async corridaYaml(): Promise<string> {
    try {
      return await readFile(
        resolve(this.trabajos.directorioExperimento, 'ejecutor', 'corrida.yaml'),
        'utf-8',
      );
    } catch {
      throw new ErrorApi('no-encontrado', 'No existe experiment/ejecutor/corrida.yaml.');
    }
  }

  @Get('consola/estado')
  estado(): EstadoConsolaDto {
    return this.trabajos.estado();
  }

  @Post('consola/corridas')
  @HttpCode(202)
  lanzarCorrida(@Body() dto: LanzarCorridaDto): TrabajoDto {
    return this.trabajos.lanzarCorrida(dto);
  }

  @Post('consola/analisis')
  @HttpCode(202)
  lanzarAnalisis(@Body() dto: LanzarAnalisisDto): TrabajoDto {
    return this.trabajos.lanzarAnalisis(dto);
  }

  @Get('consola/trabajos/:id')
  trabajo(@Param('id') id: string): TrabajoDto {
    return this.trabajos.trabajo(id);
  }

  @Post('consola/trabajos/:id/cancelar')
  cancelar(@Param('id') id: string): TrabajoDto {
    return this.trabajos.cancelar(id);
  }

  /** Flujo SSE: reproduce lo ya emitido y sigue en vivo hasta el evento `fin`. */
  @Sse('consola/trabajos/:id/eventos')
  eventos(@Param('id') id: string): Observable<{ data: EventoTrabajoDto }> {
    return this.trabajos.eventos(id).pipe(map((evento) => ({ data: evento })));
  }
}
