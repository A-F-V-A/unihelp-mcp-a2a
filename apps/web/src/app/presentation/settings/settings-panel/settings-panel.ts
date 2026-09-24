import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import {
  type CampoPerfil,
  LONGITUD_MAXIMA_NOMBRE,
  type PerfilSolicitante,
  type Preferencias,
  ROLES_SOLICITANTE,
  type RolSolicitante,
  type TamanoTexto,
  type Tema,
  inicialesDe,
  validarPerfil,
} from '../../../domain/models/preferencias';
import {
  type CatalogoModeloIa,
  type ProveedorModelo,
  type SeleccionModeloIa,
  modeloIaListo,
  proveedorDe,
  resumenModeloIa,
} from '../../../domain/models/modelo-ia';
import { VERSION_APP } from '../../shared/version';
import { BackendStatus } from '../../shell/backend-status/backend-status';

type Pantalla = 'principal' | 'perfil' | 'borrar' | 'modelo';

const ETIQUETA_ROL: Readonly<Record<RolSolicitante, string>> = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  administrativo: 'Administrativo',
  egresado: 'Egresado',
};

const OPCIONES_TEMA: readonly { readonly valor: Tema; readonly etiqueta: string }[] = [
  { valor: 'sistema', etiqueta: 'Sistema' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
];

const OPCIONES_TEXTO: readonly { readonly valor: TamanoTexto; readonly etiqueta: string }[] = [
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'grande', etiqueta: 'Grande' },
];

/** Espera a que la hoja termine de bajar antes de volver a la pantalla principal. */
const RETRASO_REINICIO_MS = 450;

/**
 * Contenido de Configuracion: perfil del solicitante, apariencia, modelo de
 * IA, datos y "acerca de". Solo emite intenciones; guardar es cosa de quien
 * lo usa.
 *
 * La pantalla de modelo NO pide la clave del proveedor: vive en el servidor y
 * la interfaz solo elige entre lo que el backend declara disponible (decision 27).
 */
@Component({
  selector: 'app-settings-panel',
  imports: [BackendStatus],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  readonly abierto = input(false);
  readonly preferencias = input.required<Preferencias>();
  readonly catalogoModelo = input.required<CatalogoModeloIa>();
  readonly errorModelo = input<string | null>(null);
  readonly cantidadConversaciones = input(0);

  readonly cambiarTema = output<Tema>();
  readonly cambiarTamanoTexto = output<TamanoTexto>();
  readonly guardarPerfil = output<PerfilSolicitante>();
  readonly guardarModeloIA = output<SeleccionModeloIa>();
  readonly borrarConversaciones = output<void>();

  protected readonly pantalla = signal<Pantalla>('principal');
  protected readonly nombre = signal('');
  protected readonly correo = signal('');
  protected readonly rol = signal<RolSolicitante>('estudiante');
  protected readonly errores = signal<Readonly<Partial<Record<CampoPerfil, string>>>>({});

  protected readonly proveedor = signal<ProveedorModelo>('chatgpt');
  protected readonly modelo = signal('');

  protected readonly iniciales = computed(() => inicialesDe(this.preferencias().perfil.nombre));
  protected readonly nombreVisible = computed(
    () => this.preferencias().perfil.nombre || 'Solicitante',
  );
  protected readonly etiquetaRol = computed(() => ETIQUETA_ROL[this.preferencias().perfil.rol]);
  protected readonly opcionesTema = OPCIONES_TEMA;
  protected readonly opcionesTexto = OPCIONES_TEXTO;
  protected readonly roles = ROLES_SOLICITANTE.map((valor) => ({
    valor,
    etiqueta: ETIQUETA_ROL[valor],
  }));
  protected readonly maximoNombre = LONGITUD_MAXIMA_NOMBRE;
  protected readonly version = VERSION_APP;

  protected readonly proveedores = computed(() => this.catalogoModelo().proveedores);
  protected readonly modeloConfigurado = computed(() => modeloIaListo(this.catalogoModelo()));
  protected readonly resumenModelo = computed(() => resumenModeloIa(this.catalogoModelo()));
  protected readonly editable = computed(() => this.catalogoModelo().editable);
  protected readonly descriptorSeleccionado = computed(() =>
    proveedorDe(this.catalogoModelo(), this.proveedor()),
  );
  protected readonly modelosDisponibles = computed(
    () => this.descriptorSeleccionado()?.modelos ?? [],
  );

  constructor() {
    effect((alLimpiar) => {
      if (this.abierto()) {
        return;
      }
      const temporizador = setTimeout(() => this.pantalla.set('principal'), RETRASO_REINICIO_MS);
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  protected editarPerfil(): void {
    const perfil = this.preferencias().perfil;
    this.nombre.set(perfil.nombre);
    this.correo.set(perfil.correo);
    this.rol.set(perfil.rol);
    this.errores.set({});
    this.pantalla.set('perfil');
  }

  protected enviarPerfil(): void {
    const validacion = validarPerfil({
      nombre: this.nombre(),
      correo: this.correo(),
      rol: this.rol(),
    });
    if (!validacion.valido) {
      this.errores.set(validacion.errores);
      return;
    }
    this.guardarPerfil.emit(validacion.perfil);
    this.pantalla.set('principal');
  }

  protected editarModelo(): void {
    const { seleccion } = this.catalogoModelo();
    this.proveedor.set(seleccion.proveedor);
    this.modelo.set(seleccion.modelo);
    this.pantalla.set('modelo');
  }

  /** Un proveedor no disponible no se puede elegir: el backend lo rechazaria igual. */
  protected elegirProveedor(proveedor: ProveedorModelo): void {
    const descriptor = proveedorDe(this.catalogoModelo(), proveedor);
    if (descriptor === null || !descriptor.disponible) {
      return;
    }
    this.proveedor.set(proveedor);
    this.modelo.set(descriptor.modeloPorDefecto ?? '');
  }

  protected elegirModelo(modelo: string): void {
    this.modelo.set(modelo);
  }

  protected enviarModelo(): void {
    this.guardarModeloIA.emit({ proveedor: this.proveedor(), modelo: this.modelo() });
    // Vuelve a la pantalla principal, donde se ve el resumen y, si lo hubo, el error.
    this.pantalla.set('principal');
  }

  protected confirmarBorrado(): void {
    this.borrarConversaciones.emit();
    this.pantalla.set('principal');
  }
}
