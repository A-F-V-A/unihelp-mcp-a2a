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
  type CampoModeloIA,
  CATALOGO_PROVEEDORES_IA,
  type ConfiguracionModeloIA,
  PROVEEDORES_IA,
  type ProveedorIA,
  enmascararToken,
  modeloIAConfigurado,
  validarConfiguracionModeloIA,
} from '../../../domain/models/proveedor-ia';
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
  readonly configuracionModelo = input.required<ConfiguracionModeloIA>();
  readonly cantidadConversaciones = input(0);

  readonly cambiarTema = output<Tema>();
  readonly cambiarTamanoTexto = output<TamanoTexto>();
  readonly guardarPerfil = output<PerfilSolicitante>();
  readonly guardarModeloIA = output<ConfiguracionModeloIA>();
  readonly borrarConversaciones = output<void>();

  protected readonly pantalla = signal<Pantalla>('principal');
  protected readonly nombre = signal('');
  protected readonly correo = signal('');
  protected readonly rol = signal<RolSolicitante>('estudiante');
  protected readonly errores = signal<Readonly<Partial<Record<CampoPerfil, string>>>>({});

  protected readonly proveedor = signal<ProveedorIA>('chatgpt');
  protected readonly modelo = signal('');
  protected readonly token = signal('');
  protected readonly urlAgenteLocal = signal('');
  protected readonly mostrarToken = signal(false);
  protected readonly erroresModelo = signal<Readonly<Partial<Record<CampoModeloIA, string>>>>({});

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

  protected readonly proveedores = PROVEEDORES_IA.map((id) => CATALOGO_PROVEEDORES_IA[id]);
  protected readonly proveedorActivo = computed(
    () => CATALOGO_PROVEEDORES_IA[this.configuracionModelo().proveedor],
  );
  protected readonly modeloConfigurado = computed(() =>
    modeloIAConfigurado(this.configuracionModelo()),
  );
  protected readonly resumenModelo = computed(() =>
    this.modeloConfigurado() ? this.proveedorActivo().nombre : 'Sin configurar',
  );
  protected readonly descriptorSeleccionado = computed(
    () => CATALOGO_PROVEEDORES_IA[this.proveedor()],
  );
  protected readonly tokenEnmascarado = computed(() => enmascararToken(this.token()));

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
    const configuracion = this.configuracionModelo();
    this.proveedor.set(configuracion.proveedor);
    this.modelo.set(configuracion.modelo);
    this.token.set(configuracion.token);
    this.urlAgenteLocal.set(configuracion.urlAgenteLocal);
    this.mostrarToken.set(false);
    this.erroresModelo.set({});
    this.pantalla.set('modelo');
  }

  protected elegirProveedor(proveedor: ProveedorIA): void {
    this.proveedor.set(proveedor);
    this.erroresModelo.set({});
  }

  protected usarModeloSugerido(modelo: string): void {
    this.modelo.set(modelo);
  }

  protected enviarModelo(): void {
    const validacion = validarConfiguracionModeloIA({
      proveedor: this.proveedor(),
      modelo: this.modelo(),
      token: this.token(),
      urlAgenteLocal: this.urlAgenteLocal(),
    });
    if (!validacion.valido) {
      this.erroresModelo.set(validacion.errores);
      return;
    }
    this.guardarModeloIA.emit(validacion.configuracion);
    this.pantalla.set('principal');
  }

  protected confirmarBorrado(): void {
    this.borrarConversaciones.emit();
    this.pantalla.set('principal');
  }
}
