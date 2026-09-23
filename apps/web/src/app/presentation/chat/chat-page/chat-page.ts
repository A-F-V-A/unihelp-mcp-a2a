import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { AreaServicio } from '@unihelp/dominio';
import {
  ConversacionStore,
  type EntradaConversacion,
  claveCita,
} from '../../../application/state/conversacion.store';
import { ModeloIAStore } from '../../../application/state/modelo-ia.store';
import { PreferenciasStore } from '../../../application/state/preferencias.store';
import type { BloqueRespuesta } from '../../../domain/models/conversacion';
import type { CitaPolitica } from '../../../domain/models/politica';
import type { PerfilSolicitante, TamanoTexto, Tema } from '../../../domain/models/preferencias';
import { type SeleccionModeloIa, modeloIaListo } from '../../../domain/models/modelo-ia';
import type { EstadoServicio } from '../../../domain/models/servicio';
import type { Ticket } from '../../../domain/models/ticket';
import { SettingsPanel } from '../../settings/settings-panel/settings-panel';
import { FechaPipe } from '../../shared/fecha.pipe';
import { ETIQUETA_ESTADO_INCIDENTE } from '../../shared/formato';
import { AppLayout } from '../../shell/app-layout/app-layout';
import { BottomSheet } from '../../shell/bottom-sheet/bottom-sheet';
import { SideDrawer } from '../../shell/side-drawer/side-drawer';
import { ChatHeader } from '../components/chat-header/chat-header';
import { ClassificationBadge } from '../components/classification-badge/classification-badge';
import { ConfirmationPrompt } from '../components/confirmation-prompt/confirmation-prompt';
import { ErrorMessage } from '../components/error-message/error-message';
import { MaintenanceNotice } from '../components/maintenance-notice/maintenance-notice';
import { MessageComposer } from '../components/message-composer/message-composer';
import { PolicyCitation } from '../components/policy-citation/policy-citation';
import { ScopeWarningBanner } from '../components/scope-warning-banner/scope-warning-banner';
import { ServiceStatusCard } from '../components/service-status-card/service-status-card';
import { TicketCreatedCard } from '../components/ticket-created-card/ticket-created-card';
import { TurnLimitNotice } from '../components/turn-limit-notice/turn-limit-notice';
import { TypingIndicator } from '../components/typing-indicator/typing-indicator';
import { WelcomePanel } from '../components/welcome-panel/welcome-panel';

/** Solicitudes de ejemplo para arrancar; son preguntas validas para cualquier backend. */
const EJEMPLOS: readonly string[] = [
  'No puedo entregar la tarea en el aula virtual, la página no carga',
  '¿Hasta cuándo puedo cancelar una asignatura?',
  'No puedo pagar la matrícula por PSE y el plazo vence mañana',
  'Los correos institucionales no salen desde esta mañana',
  '¿Puedo renovar libros de la biblioteca en línea hoy?',
  '¿Dónde puedo parquear la moto dentro del campus?',
];

/** Aire entre la cabecera flotante y el inicio de un mensaje al llevarlo a la vista. */
const MARGEN_SUPERIOR_PX = 8;
/** Distancia al final bajo la cual se considera que el usuario "esta abajo". */
const UMBRAL_FINAL_PX = 160;
/** Parte minima de un mensaje que debe verse para considerarlo visible. */
const VISIBLE_MINIMO_PX = 48;

type Hoja = 'acerca' | 'sugerencias' | 'tickets' | 'ticket' | 'opciones' | 'ajustes';

function tieneBloque(entrada: EntradaConversacion, tipo: BloqueRespuesta['tipo']): boolean {
  return entrada.rol === 'asistente' && entrada.bloques.some((bloque) => bloque.tipo === tipo);
}

/**
 * Pantalla principal: conversacion activa, historial en el menu lateral y
 * hojas inferiores. Solo conoce los stores: lee signals y traduce eventos de
 * la UI en comandos. No sabe de repositorios ni de HTTP.
 */
@Component({
  selector: 'app-chat-page',
  imports: [
    AppLayout,
    BottomSheet,
    ChatHeader,
    ClassificationBadge,
    ConfirmationPrompt,
    ErrorMessage,
    FechaPipe,
    MaintenanceNotice,
    MessageComposer,
    PolicyCitation,
    ScopeWarningBanner,
    ServiceStatusCard,
    SettingsPanel,
    SideDrawer,
    TicketCreatedCard,
    TurnLimitNotice,
    TypingIndicator,
    WelcomePanel,
  ],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage {
  private readonly store = inject(ConversacionStore);
  private readonly preferenciasStore = inject(PreferenciasStore);
  private readonly modeloIAStore = inject(ModeloIAStore);

  protected readonly conversaciones = this.store.conversaciones;
  protected readonly cargandoConversaciones = this.store.cargandoConversaciones;
  protected readonly errorConversaciones = this.store.errorConversaciones;
  protected readonly conversacionId = this.store.conversacionId;
  protected readonly entradas = this.store.entradas;
  protected readonly esperandoRespuesta = this.store.esperandoRespuesta;
  protected readonly cargandoHistorial = this.store.cargandoHistorial;
  protected readonly conteoTurnos = this.store.conteoTurnos;
  protected readonly turnosMaximos = this.store.turnosMaximos;
  protected readonly limiteAlcanzado = this.store.limiteAlcanzado;
  protected readonly puedeEscribir = this.store.puedeEscribir;
  protected readonly conversacionVacia = this.store.conversacionVacia;
  protected readonly ticketsSesion = this.store.ticketsSesion;
  protected readonly preferencias = this.preferenciasStore.preferencias;
  protected readonly catalogoModelo = this.modeloIAStore.catalogo;
  protected readonly errorModelo = this.modeloIAStore.error;
  protected readonly ejemplos = EJEMPLOS;
  protected readonly etiquetasEstado = ETIQUETA_ESTADO_INCIDENTE;

  protected readonly textoTurnos = computed(() => {
    const maximos = this.turnosMaximos();
    return maximos === null ? null : `Turno ${this.conteoTurnos()} de ${maximos}`;
  });

  /** Resumen del proveedor de IA, visible desde "Cómo funciona" sin entrar a Configuración. */
  protected readonly resumenModeloIA = computed(() => {
    const resumen = this.modeloIAStore.resumen();
    return modeloIaListo(this.catalogoModelo()) ? resumen : `${resumen} (sin configurar)`;
  });

  protected readonly menuAbierto = signal(false);
  protected readonly hoja = signal<Hoja | null>(null);
  protected readonly ticketSeleccionado = signal<Ticket | null>(null);
  protected readonly opcionesId = signal<string | null>(null);
  protected readonly confirmandoEliminar = signal(false);
  protected readonly conversacionOpciones = computed(
    () => this.conversaciones().find((c) => c.id === this.opcionesId()) ?? null,
  );
  /** Altura real del pie flotante: el contenido deja ese espacio libre abajo. */
  protected readonly altoPie = signal(0);
  /** Texto del boton flotante que anuncia contenido nuevo fuera de la vista. */
  protected readonly avisoNuevo = signal<string | null>(null);

  private readonly lista = viewChild.required<ElementRef<HTMLElement>>('lista');
  private readonly pie = viewChild.required<ElementRef<HTMLElement>>('pie');
  private readonly movimientoReducido =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private conteoAnterior = 0;
  private indiceAviso = -1;

  constructor() {
    void this.store.iniciar();
    void this.modeloIAStore.iniciar();

    afterRenderEffect(() => {
      this.acompanarConversacion(this.entradas(), this.esperandoRespuesta());
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const pie = this.pie().nativeElement;
      const observador = new ResizeObserver(() =>
        this.altoPie.set(Math.round(pie.getBoundingClientRect().height)),
      );
      observador.observe(pie);
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  protected enviar(texto: string): void {
    void this.store.enviar(texto);
  }

  protected reintentar(avisoId: string): void {
    void this.store.reintentar(avisoId);
  }

  protected confirmar(propuestaId: string): void {
    void this.store.confirmarPropuesta(propuestaId);
  }

  protected rechazar(propuestaId: string): void {
    void this.store.rechazarPropuesta(propuestaId);
  }

  protected consultarPolitica(cita: CitaPolitica): void {
    void this.store.consultarPolitica(cita);
  }

  protected actualizarServicio(servicio: AreaServicio): void {
    void this.store.actualizarEstadoServicio(servicio);
  }

  protected abrirHoja(hoja: Hoja): void {
    this.menuAbierto.set(false);
    this.hoja.set(hoja);
  }

  protected cerrarHoja(): void {
    this.hoja.set(null);
  }

  /** Como en las apps de chat: la conversacion actual queda en el historial. */
  protected nuevaConversacion(): void {
    this.menuAbierto.set(false);
    this.hoja.set(null);
    this.store.nuevaConversacion();
  }

  protected abrirConversacion(conversacionId: string): void {
    this.menuAbierto.set(false);
    this.hoja.set(null);
    void this.store.abrirConversacion(conversacionId);
  }

  protected verOpciones(conversacionId: string): void {
    this.opcionesId.set(conversacionId);
    this.confirmandoEliminar.set(false);
    this.abrirHoja('opciones');
  }

  protected eliminarConversacion(conversacionId: string): void {
    this.hoja.set(null);
    void this.store.eliminarConversacion(conversacionId);
  }

  protected recargarConversaciones(): void {
    void this.store.cargarConversaciones();
  }

  protected elegirSugerencia(texto: string): void {
    this.hoja.set(null);
    this.enviar(texto);
  }

  protected verTicket(numero: string): void {
    this.ticketSeleccionado.set(this.ticketsSesion().find((t) => t.numero === numero) ?? null);
    this.abrirHoja('ticket');
  }

  protected cambiarTema(tema: Tema): void {
    void this.preferenciasStore.cambiarTema(tema);
  }

  protected cambiarTamanoTexto(tamano: TamanoTexto): void {
    void this.preferenciasStore.cambiarTamanoTexto(tamano);
  }

  protected guardarPerfil(perfil: PerfilSolicitante): void {
    void this.preferenciasStore.guardarPerfil(perfil);
  }

  protected guardarModeloIA(seleccion: SeleccionModeloIa): void {
    void this.modeloIAStore.seleccionar(seleccion);
  }

  /** Desde "Cómo funciona": va directo a Configuración a elegir el proveedor. */
  protected configurarModeloDesdeChat(): void {
    this.abrirHoja('ajustes');
  }

  protected borrarConversaciones(): void {
    void this.store.eliminarTodas();
  }

  protected detallePolitica(cita: CitaPolitica) {
    return this.store.politicas()[claveCita(cita)] ?? null;
  }

  /** Si el usuario refresco el estado, se muestra el ultimo valor conocido. */
  protected estadoVigente(estado: EstadoServicio): EstadoServicio {
    return this.store.estadosServicio()[estado.servicio]?.valor ?? estado;
  }

  protected recursoServicio(servicio: AreaServicio) {
    return this.store.estadosServicio()[servicio] ?? null;
  }

  protected accionPropuesta(propuestaId: string) {
    return this.store.accionesPropuesta()[propuestaId] ?? null;
  }

  protected errorPropuesta(propuestaId: string) {
    return this.store.erroresPropuesta()[propuestaId] ?? null;
  }

  protected verNuevo(): void {
    const nodo = this.nodoEntrada(this.indiceAviso);
    if (nodo) {
      this.desplazarA(this.inicioDe(nodo));
    }
    this.avisoNuevo.set(null);
  }

  protected alDesplazar(): void {
    if (this.avisoNuevo() === null) {
      return;
    }
    const nodo = this.nodoEntrada(this.indiceAviso);
    if (!nodo || this.esVisible(nodo)) {
      this.avisoNuevo.set(null);
    }
  }

  /**
   * Mueve la vista cuando cambia la conversacion. En un celular una respuesta
   * puede ocupar varias pantallas, asi que se muestra desde su INICIO en lugar
   * de saltar al final. Lo que llega sin que el usuario lo pida (por ejemplo la
   * propuesta de ticket, que sigue a la respuesta) no interrumpe la lectura:
   * se anuncia con un boton flotante.
   */
  private acompanarConversacion(
    entradas: readonly EntradaConversacion[],
    esperando: boolean,
  ): void {
    const lista = this.lista().nativeElement;
    const anterior = this.conteoAnterior;
    this.conteoAnterior = entradas.length;

    if (entradas.length === 0) {
      this.avisoNuevo.set(null);
      return;
    }

    if (entradas.length <= anterior) {
      // Sin mensajes nuevos: solo acompanar el indicador de escritura si ya estaba abajo.
      if (esperando && this.cercaDelFinal(lista)) {
        this.desplazarA(lista.scrollHeight);
      }
      return;
    }

    if (anterior === 0 && entradas.length > 1) {
      // Conversacion abierta desde el historial: se retoma donde quedo.
      this.desplazarA(lista.scrollHeight, 'auto');
      return;
    }

    const nueva = entradas[anterior];
    const previa = entradas[anterior - 1];
    const nodo = this.nodoEntrada(anterior);

    if (!nodo || nueva.rol === 'usuario' || nueva.rol === 'aclaracion') {
      this.avisoNuevo.set(null);
      this.desplazarA(lista.scrollHeight);
      return;
    }

    const respondeAlUsuario =
      previa?.rol === 'usuario' || nueva.rol === 'error' || tieneBloque(nueva, 'ticket-creado');
    if (respondeAlUsuario) {
      this.avisoNuevo.set(null);
      this.desplazarA(this.inicioDe(nodo));
      return;
    }

    if (!this.esVisible(nodo)) {
      this.indiceAviso = anterior;
      this.avisoNuevo.set(
        tieneBloque(nueva, 'propuesta-ticket') ? 'Ver propuesta de ticket' : 'Ver mensaje nuevo',
      );
    }
  }

  private nodoEntrada(indice: number): HTMLElement | null {
    if (indice < 0) {
      return null;
    }
    return this.lista().nativeElement.querySelectorAll<HTMLElement>('[data-entrada]').item(indice);
  }

  /** Posicion de scroll que deja el nodo justo debajo de la cabecera flotante. */
  private inicioDe(nodo: HTMLElement): number {
    const cabecera = parseFloat(getComputedStyle(this.lista().nativeElement).paddingTop) || 0;
    return nodo.offsetTop - cabecera - MARGEN_SUPERIOR_PX;
  }

  private esVisible(nodo: HTMLElement): boolean {
    const lista = this.lista().nativeElement;
    const limiteInferior = lista.scrollTop + lista.clientHeight - this.altoPie();
    return nodo.offsetTop < limiteInferior - VISIBLE_MINIMO_PX;
  }

  private cercaDelFinal(lista: HTMLElement): boolean {
    return lista.scrollHeight - lista.scrollTop - lista.clientHeight < UMBRAL_FINAL_PX;
  }

  private desplazarA(
    top: number,
    comportamiento: ScrollBehavior = this.movimientoReducido ? 'auto' : 'smooth',
  ): void {
    const lista = this.lista().nativeElement;
    const destino = Math.max(0, top);
    if (typeof lista.scrollTo === 'function') {
      lista.scrollTo({ top: destino, behavior: comportamiento });
    } else {
      lista.scrollTop = destino;
    }
  }
}
