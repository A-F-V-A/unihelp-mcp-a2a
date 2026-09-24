import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IDENTIFICADORES_ARQUITECTURA, type IdentificadorArquitectura } from '@unihelp/dominio';
import { ConsolaStore } from '../../../../application/state/consola.store';
import { ExperimentoStore } from '../../../../application/state/experimento.store';
import { MODOS_LLM, type ModoLlm } from '../../../../domain/models/experimento/corrida';
import {
  CATEGORIAS_TAREA,
  type CategoriaTarea,
} from '../../../../domain/models/experimento/tarea-evaluacion';
import {
  PASOS_PREVIOS_CORRIDA,
  type SeleccionCorrida,
  compactarTareas,
  construirComandoCorrida,
  validarSeleccionCorrida,
} from '../../../../domain/rules/experimento/comando-corrida.rules';
import { ETIQUETA_CATEGORIA, claseArquitectura } from '../../shared/etiquetas-experimento';
import { EstadoRecurso } from '../../shared/estado-recurso/estado-recurso';
import { JobMonitor } from '../job-monitor/job-monitor';

/**
 * Elegir arquitectura y tareas, comprobar los backends y CORRER. Si la consola
 * del experimento responde, la corrida se lanza desde aqui y se sigue en vivo
 * (decision 39); si no, se muestra la misma linea de comandos para la
 * terminal. En ambos casos la configuracion es `corrida.yaml` mas las
 * anulaciones visibles, asi que el `config_hash` es el mismo.
 */
@Component({
  selector: 'app-run-planner',
  imports: [RouterLink, EstadoRecurso, JobMonitor],
  templateUrl: './run-planner.html',
  styleUrl: './run-planner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunPlanner {
  private readonly store = inject(ExperimentoStore);
  private readonly consola = inject(ConsolaStore);

  protected readonly configuracion = this.store.configuracion;
  protected readonly catalogoTareas = this.store.tareas;
  protected readonly backends = this.store.backends;
  protected readonly disponibilidad = this.consola.disponibilidad;
  protected readonly detalleConsola = this.consola.detalle;
  protected readonly errorConsola = this.consola.error;
  protected readonly trabajo = this.consola.trabajo;
  protected readonly enMarcha = this.consola.enMarcha;
  protected readonly lanzando = this.consola.lanzando;
  protected readonly arquitecturasDisponibles = IDENTIFICADORES_ARQUITECTURA;
  protected readonly modos = MODOS_LLM;
  protected readonly categorias = CATEGORIAS_TAREA;
  protected readonly etiquetaCategoria = ETIQUETA_CATEGORIA;
  protected readonly claseArquitectura = claseArquitectura;
  protected readonly pasosPrevios = PASOS_PREVIOS_CORRIDA;

  protected readonly arquitecturas = signal<IdentificadorArquitectura[]>(['B0']);
  /** `null` = todas. */
  protected readonly seleccionadas = signal<Set<string> | null>(null);
  protected readonly repeticiones = signal<number | null>(null);
  protected readonly modoLlm = signal<ModoLlm | null>(null);
  protected readonly nombre = signal('');
  protected readonly copiado = signal(false);

  protected readonly todas = computed(() => this.catalogoTareas().valor ?? []);
  protected readonly cuantasSeleccionadas = computed(
    () => this.seleccionadas()?.size ?? this.todas().length,
  );

  protected readonly seleccion = computed<SeleccionCorrida>(() => {
    const marcadas = this.seleccionadas();
    return {
      arquitecturas: this.arquitecturas(),
      tareas: marcadas === null ? null : compactarTareas([...marcadas], this.todas()),
      repeticiones: this.repeticiones(),
      modoLlm: this.modoLlm(),
      nombre: this.nombre() || null,
    };
  });
  protected readonly validacion = computed(() => validarSeleccionCorrida(this.seleccion()));
  protected readonly comando = computed(() => {
    const v = this.validacion();
    return v.valida ? construirComandoCorrida(v.seleccion) : null;
  });
  /** Los backends elegidos que todavia no se comprobaron o no respondieron. */
  protected readonly backendsSinConfirmar = computed(() =>
    this.arquitecturas().filter((a) => !this.backends()[a]?.salud),
  );

  private iniciado = false;

  constructor() {
    void this.store.cargarConfiguracion();
    void this.store.iniciarTareas();
    void this.consola.comprobar();
    // La configuracion del ejecutor fija los valores iniciales una sola vez.
    effect(() => {
      const config = this.configuracion().valor;
      if (config && !this.iniciado) {
        this.iniciado = true;
        this.arquitecturas.set([...config.arquitecturas]);
      }
    });
    // Lo que el explorador de tareas dejo elegido, si se llego desde alli.
    const preparadas = this.store.tareasPreparadas();
    if (preparadas) {
      this.seleccionadas.set(new Set(preparadas));
    }
  }

  protected recargarConfiguracion(): void {
    void this.store.cargarConfiguracion();
  }

  protected comprobarConsola(): void {
    void this.consola.comprobar();
  }

  protected alternarArquitectura(arquitectura: IdentificadorArquitectura): void {
    this.arquitecturas.update((lista) =>
      lista.includes(arquitectura)
        ? lista.filter((a) => a !== arquitectura)
        : [...IDENTIFICADORES_ARQUITECTURA].filter((a) => a === arquitectura || lista.includes(a)),
    );
  }

  protected marcarTodas(): void {
    this.seleccionadas.set(null);
  }

  protected marcarCategoria(categoria: CategoriaTarea): void {
    const ids = this.todas()
      .filter((t) => t.categoria === categoria)
      .map((t) => t.id);
    this.seleccionadas.update((actual) => {
      const conjunto = new Set(actual ?? []);
      const completa = ids.every((id) => conjunto.has(id));
      ids.forEach((id) => (completa ? conjunto.delete(id) : conjunto.add(id)));
      return conjunto;
    });
  }

  protected alternarTarea(id: string): void {
    this.seleccionadas.update((actual) => {
      const conjunto = new Set(actual ?? this.todas().map((t) => t.id));
      if (conjunto.has(id)) {
        conjunto.delete(id);
      } else {
        conjunto.add(id);
      }
      return conjunto;
    });
  }

  protected estaMarcada(id: string): boolean {
    const marcadas = this.seleccionadas();
    return marcadas === null || marcadas.has(id);
  }

  protected cambiarRepeticiones(valor: string): void {
    this.repeticiones.set(valor.trim() === '' ? null : Number(valor));
  }

  protected cambiarModo(valor: string): void {
    this.modoLlm.set(valor === '' ? null : (valor as ModoLlm));
  }

  protected comprobar(arquitectura: IdentificadorArquitectura): void {
    const url = this.configuracion().valor?.backends[arquitectura];
    if (url) {
      void this.store.comprobarBackend(arquitectura, url);
    }
  }

  /** Lanza la corrida en la consola con la misma seleccion que arma el comando. */
  protected async correr(): Promise<void> {
    const lanzada = await this.consola.lanzarCorrida(this.seleccion());
    if (lanzada) {
      this.nombre.set('');
    }
  }

  protected async copiar(): Promise<void> {
    const comando = this.comando();
    if (!comando) {
      return;
    }
    try {
      await navigator.clipboard.writeText(comando);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      // Sin permiso de portapapeles el texto sigue visible para copiarlo a mano.
    }
  }
}
