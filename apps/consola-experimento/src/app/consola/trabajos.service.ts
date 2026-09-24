import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Injectable, Logger } from '@nestjs/common';
import type {
  EstadoConsolaDto,
  EventoTrabajoDto,
  LanzarAnalisisDto,
  LanzarCorridaDto,
  LineaTrabajoDto,
  TipoTrabajoConsola,
  TrabajoDto,
} from '@unihelp/contratos';
import { Observable, ReplaySubject } from 'rxjs';
import { ErrorApi } from '../http/error-api';
import {
  argumentosAnalisis,
  argumentosCorrida,
  argumentosIndice,
  comandoLegible,
  validarNombreCorrida,
} from './argumentos';

/** Trabajos terminados que se conservan en memoria para poder consultarlos. */
const HISTORIAL_MAXIMO = 20;

interface Trabajo {
  dto: TrabajoDto;
  proceso: ChildProcess | null;
  /** Reproduce todo lo emitido a quien se conecte tarde, y cierra con `fin`. */
  eventos: ReplaySubject<EventoTrabajoDto>;
  cancelacionPedida: boolean;
}

/**
 * Lanza UN proceso a la vez (RM-04: dos corridas simultaneas se pisarian el
 * estado de la base de conocimiento) y conserva su salida linea a linea.
 *
 * Lo que lanza son los mismos comandos del README de `experiment/`, con `uv`
 * sobre `experiment/`; la consola no sabe nada de trazas ni de metricas.
 */
@Injectable()
export class TrabajosService {
  private readonly logger = new Logger(TrabajosService.name);
  readonly ejecutable = process.env.UNIHELP_UV ?? 'uv';
  readonly directorioExperimento = resolve(
    process.cwd(),
    process.env.UNIHELP_DIRECTORIO_EXPERIMENTO ?? 'experiment',
  );

  private activo: Trabajo | null = null;
  private readonly historial = new Map<string, Trabajo>();
  private ultimo: Trabajo | null = null;

  estado(): EstadoConsolaDto {
    const trabajo = this.activo ?? this.ultimo;
    return {
      trabajo: trabajo ? trabajo.dto : null,
      ejecutable: this.ejecutable,
      directorioExperimento: this.directorioExperimento,
    };
  }

  trabajo(id: string): TrabajoDto {
    return this.buscar(id).dto;
  }

  eventos(id: string): Observable<EventoTrabajoDto> {
    return this.buscar(id).eventos.asObservable();
  }

  lanzarCorrida(dto: LanzarCorridaDto): TrabajoDto {
    const argumentos = argumentosCorrida(dto);
    // El nombre lo pone el ejecutor si no viene: se anota en la primera linea
    // ("Corrida en <directorio>") y de ahi lo toma la consola.
    return this.lanzar('corrida', argumentos, dto.nombre ?? null);
  }

  lanzarAnalisis(dto: LanzarAnalisisDto): TrabajoDto {
    const nombre = validarNombreCorrida(dto.corrida);
    if (!existsSync(resolve(this.directorioExperimento, 'corridas', nombre, 'trazas.jsonl'))) {
      throw new ErrorApi('no-encontrado', `La corrida ${nombre} no tiene trazas.jsonl.`);
    }
    return this.lanzar('analisis', argumentosAnalisis(dto), nombre);
  }

  cancelar(id: string): TrabajoDto {
    const trabajo = this.buscar(id);
    if (trabajo.dto.estado !== 'en_marcha' || !trabajo.proceso) {
      return trabajo.dto;
    }
    trabajo.cancelacionPedida = true;
    this.matar(trabajo.proceso);
    return trabajo.dto;
  }

  private lanzar(
    tipo: TipoTrabajoConsola,
    argumentos: string[],
    corrida: string | null,
  ): TrabajoDto {
    if (this.activo) {
      throw new ErrorApi(
        'conflicto',
        `Ya hay un trabajo en marcha (${this.activo.dto.id}); las corridas van de a una (RM-04).`,
        { trabajoId: this.activo.dto.id },
      );
    }
    if (!existsSync(this.directorioExperimento)) {
      throw new ErrorApi('interno', `No existe el directorio ${this.directorioExperimento}.`);
    }
    const id = `${tipo}-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}`;
    const trabajo: Trabajo = {
      dto: {
        id,
        tipo,
        estado: 'en_marcha',
        comando: comandoLegible(this.ejecutable, argumentos),
        corrida,
        iniciadoEn: new Date().toISOString(),
        terminadoEn: null,
        codigoSalida: null,
        lineas: [],
      },
      proceso: null,
      eventos: new ReplaySubject<EventoTrabajoDto>(),
      cancelacionPedida: false,
    };
    this.activo = trabajo;
    this.historial.set(id, trabajo);
    this.recortarHistorial();
    this.logger.log(`Lanzando ${tipo}: ${trabajo.dto.comando}`);

    const proceso = this.arrancar(argumentos);
    trabajo.proceso = proceso;
    this.escuchar(trabajo, proceso, () => {
      // Tras una corrida, se reescribe el catalogo aunque se haya cancelado:
      // el ejecutor solo lo escribe al terminar y el panel lo necesita.
      if (tipo === 'corrida') {
        this.agregarLinea(trabajo, 'stdout', '· consola: reescribiendo corridas/indice.json');
        const indice = this.arrancar(argumentosIndice());
        this.escuchar(trabajo, indice, () => this.cerrar(trabajo), false);
      } else {
        this.cerrar(trabajo);
      }
    });
    return trabajo.dto;
  }

  private arrancar(argumentos: string[]): ChildProcess {
    return spawn(this.ejecutable, argumentos, {
      cwd: this.directorioExperimento,
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  private escuchar(
    trabajo: Trabajo,
    proceso: ChildProcess,
    alTerminar: () => void,
    principal = true,
  ): void {
    for (const [origen, flujo] of [
      ['stdout', proceso.stdout],
      ['stderr', proceso.stderr],
    ] as const) {
      if (!flujo) {
        continue;
      }
      createInterface({ input: flujo }).on('line', (texto) => {
        this.agregarLinea(trabajo, origen, texto);
        if (principal && trabajo.dto.corrida === null) {
          // "Corrida en D:\...\corridas\20260924T031102Z (abc123)"
          const marca = /^Corrida en (.+?) \(/.exec(texto);
          if (marca) {
            trabajo.dto = { ...trabajo.dto, corrida: marca[1].split(/[\\/]/).pop() ?? null };
          }
        }
      });
    }
    proceso.on('error', (error) => {
      this.agregarLinea(
        trabajo,
        'stderr',
        `· consola: no se pudo lanzar ${this.ejecutable}: ${error.message}`,
      );
      if (principal) {
        trabajo.dto = { ...trabajo.dto, codigoSalida: -1 };
      }
      alTerminar();
    });
    proceso.on('close', (codigo) => {
      if (principal) {
        trabajo.dto = { ...trabajo.dto, codigoSalida: codigo };
      }
      alTerminar();
    });
  }

  private agregarLinea(trabajo: Trabajo, origen: 'stdout' | 'stderr', texto: string): void {
    const linea: LineaTrabajoDto = {
      numero: trabajo.dto.lineas.length + 1,
      origen,
      texto,
      en: new Date().toISOString(),
    };
    trabajo.dto = { ...trabajo.dto, lineas: [...trabajo.dto.lineas, linea] };
    trabajo.eventos.next({ tipo: 'linea', linea });
  }

  private cerrar(trabajo: Trabajo): void {
    if (trabajo.dto.estado !== 'en_marcha') {
      return;
    }
    const estado = trabajo.cancelacionPedida
      ? 'cancelado'
      : trabajo.dto.codigoSalida === 0
        ? 'terminado'
        : 'fallido';
    trabajo.dto = { ...trabajo.dto, estado, terminadoEn: new Date().toISOString() };
    trabajo.proceso = null;
    if (this.activo === trabajo) {
      this.activo = null;
    }
    this.ultimo = trabajo;
    this.logger.log(`${trabajo.dto.id}: ${estado} (codigo ${trabajo.dto.codigoSalida})`);
    trabajo.eventos.next({ tipo: 'fin', trabajo: trabajo.dto });
    trabajo.eventos.complete();
  }

  /** En Windows `kill()` solo alcanza a `uv`; el arbol completo se termina con taskkill. */
  private matar(proceso: ChildProcess): void {
    if (process.platform === 'win32' && proceso.pid) {
      spawn('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { windowsHide: true });
    } else {
      proceso.kill('SIGTERM');
    }
  }

  private buscar(id: string): Trabajo {
    const trabajo = this.historial.get(id);
    if (!trabajo) {
      throw new ErrorApi('no-encontrado', `No hay ningun trabajo ${id}.`);
    }
    return trabajo;
  }

  private recortarHistorial(): void {
    while (this.historial.size > HISTORIAL_MAXIMO) {
      const masViejo = this.historial.keys().next().value;
      if (masViejo === undefined || this.historial.get(masViejo) === this.activo) {
        break;
      }
      this.historial.delete(masViejo);
    }
  }
}
