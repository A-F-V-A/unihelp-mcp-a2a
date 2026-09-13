import { Injectable, computed, inject, signal } from '@angular/core';
import type { AreaServicio } from '@unihelp/dominio';
import {
  type CodigoErrorBackend,
  type ErrorBackend,
  normalizarError,
} from '../../domain/errors/error-backend';
import type {
  Mensaje,
  MensajeAsistente,
  MensajeUsuario,
  ResumenConversacion,
  Turnos,
} from '../../domain/models/conversacion';
import type { CitaPolitica, Politica } from '../../domain/models/politica';
import type { EstadoServicio } from '../../domain/models/servicio';
import type { PropuestaTicket, Ticket } from '../../domain/models/ticket';
import { propuestaPendiente } from '../../domain/rules/propuesta.rules';
import { limiteTurnosAlcanzado } from '../../domain/rules/respuesta.rules';
import { validarSolicitud } from '../../domain/rules/solicitud.rules';
import { SESION_CONVERSACION } from '../di/tokens';
import { ConfirmarTicketUseCase } from '../use-cases/confirmar-ticket.use-case';
import { ConsultarEstadoServicioUseCase } from '../use-cases/consultar-estado-servicio.use-case';
import { ConsultarPoliticaUseCase } from '../use-cases/consultar-politica.use-case';
import { EliminarConversacionUseCase } from '../use-cases/eliminar-conversacion.use-case';
import { EnviarMensajeUseCase } from '../use-cases/enviar-mensaje.use-case';
import { ListarConversacionesUseCase } from '../use-cases/listar-conversaciones.use-case';
import { ObtenerHistorialUseCase } from '../use-cases/obtener-historial.use-case';
import { ProponerTicketUseCase } from '../use-cases/proponer-ticket.use-case';
import { RechazarTicketUseCase } from '../use-cases/rechazar-ticket.use-case';

/** Error listo para mostrarse: sin clases ni metodos, apto para signals. */
export interface ErrorVista {
  readonly codigo: CodigoErrorBackend;
  readonly mensaje: string;
  readonly reintentable: boolean;
}

export type Reintento =
  | { readonly accion: 'enviar'; readonly texto: string; readonly mensajeProvisionalId: string }
  | { readonly accion: 'proponer-ticket' }
  | { readonly accion: 'cargar-historial'; readonly conversacionId: string };

/** Peticion de aclaracion local: el texto no llego a enviarse. */
export interface AvisoAclaracion {
  readonly id: string;
  readonly rol: 'aclaracion';
  readonly textoOriginal: string;
  readonly mensaje: string;
}

export interface AvisoError {
  readonly id: string;
  readonly rol: 'error';
  readonly error: ErrorVista;
  readonly reintento: Reintento;
}

export type EntradaConversacion = Mensaje | AvisoAclaracion | AvisoError;

/** Recurso que se carga bajo demanda y conserva el ultimo valor mientras se refresca. */
export interface EstadoRecurso<T> {
  readonly cargando: boolean;
  readonly valor: T | null;
  readonly error: ErrorVista | null;
}

export type AccionPropuesta = 'confirmando' | 'rechazando';

export const claveCita = (cita: Pick<CitaPolitica, 'codigo' | 'version'>) =>
  `${cita.codigo}@${cita.version}`;

const aVista = (error: ErrorBackend): ErrorVista => ({
  codigo: error.codigo,
  mensaje: error.message,
  reintentable: error.reintentable,
});

/** Une listas de resumenes quedandose con la version mas reciente de cada conversacion. */
function fusionarResumenes(
  ...listas: readonly (readonly ResumenConversacion[])[]
): ResumenConversacion[] {
  const porId = new Map<string, ResumenConversacion>();
  for (const resumen of listas.flat()) {
    const actual = porId.get(resumen.id);
    if (!actual || resumen.actualizadaEn.getTime() >= actual.actualizadaEn.getTime()) {
      porId.set(resumen.id, resumen);
    }
  }
  return [...porId.values()].sort((a, b) => b.actualizadaEn.getTime() - a.actualizadaEn.getTime());
}

/**
 * Estado de las conversaciones del solicitante: la lista (historial) y la
 * conversacion abierta. Orquesta casos de uso y expone todo como signals de
 * solo lectura; no sabe si detras hay un backend real o simulado.
 */
@Injectable({ providedIn: 'root' })
export class ConversacionStore {
  private readonly enviarMensajeUseCase = inject(EnviarMensajeUseCase);
  private readonly obtenerHistorialUseCase = inject(ObtenerHistorialUseCase);
  private readonly listarConversacionesUseCase = inject(ListarConversacionesUseCase);
  private readonly eliminarConversacionUseCase = inject(EliminarConversacionUseCase);
  private readonly proponerTicketUseCase = inject(ProponerTicketUseCase);
  private readonly confirmarTicketUseCase = inject(ConfirmarTicketUseCase);
  private readonly rechazarTicketUseCase = inject(RechazarTicketUseCase);
  private readonly consultarPoliticaUseCase = inject(ConsultarPoliticaUseCase);
  private readonly consultarEstadoServicioUseCase = inject(ConsultarEstadoServicioUseCase);
  private readonly sesion = inject(SESION_CONVERSACION);

  private readonly _conversaciones = signal<readonly ResumenConversacion[]>([]);
  private readonly _cargandoConversaciones = signal(false);
  private readonly _errorConversaciones = signal<ErrorVista | null>(null);

  private readonly _entradas = signal<readonly EntradaConversacion[]>([]);
  private readonly _conversacionId = signal<string | null>(null);
  private readonly _turnos = signal<Turnos | null>(null);
  private readonly _esperandoRespuesta = signal(false);
  private readonly _cargandoHistorial = signal(false);
  private readonly _accionesPropuesta = signal<Readonly<Record<string, AccionPropuesta>>>({});
  private readonly _erroresPropuesta = signal<Readonly<Record<string, ErrorVista>>>({});
  private readonly _politicas = signal<Readonly<Record<string, EstadoRecurso<Politica>>>>({});
  private readonly _estadosServicio = signal<
    Readonly<Partial<Record<AreaServicio, EstadoRecurso<EstadoServicio>>>>
  >({});
  /** Tickets creados en esta sesion; se conservan al cambiar de conversacion. */
  private readonly _ticketsSesion = signal<readonly Ticket[]>([]);

  /** Historial de conversaciones, de la mas reciente a la mas antigua. */
  readonly conversaciones = this._conversaciones.asReadonly();
  readonly cargandoConversaciones = this._cargandoConversaciones.asReadonly();
  readonly errorConversaciones = this._errorConversaciones.asReadonly();

  readonly entradas = this._entradas.asReadonly();
  readonly conversacionId = this._conversacionId.asReadonly();
  readonly turnos = this._turnos.asReadonly();
  readonly esperandoRespuesta = this._esperandoRespuesta.asReadonly();
  readonly cargandoHistorial = this._cargandoHistorial.asReadonly();
  readonly accionesPropuesta = this._accionesPropuesta.asReadonly();
  readonly erroresPropuesta = this._erroresPropuesta.asReadonly();
  readonly politicas = this._politicas.asReadonly();
  readonly estadosServicio = this._estadosServicio.asReadonly();
  readonly ticketsSesion = this._ticketsSesion.asReadonly();

  /** Turnos consumidos en la conversacion activa (HU-FE-07). */
  readonly conteoTurnos = computed(() => this._turnos()?.usados ?? 0);
  readonly turnosMaximos = computed(() => this._turnos()?.maximos ?? null);
  readonly limiteAlcanzado = computed(() => {
    const turnos = this._turnos();
    return turnos !== null && limiteTurnosAlcanzado(turnos);
  });
  readonly puedeEscribir = computed(
    () => !this._esperandoRespuesta() && !this._cargandoHistorial() && !this.limiteAlcanzado(),
  );
  readonly conversacionVacia = computed(() => this._entradas().length === 0);

  private secuenciaLocal = 0;
  /** Cambia al abrir otra conversacion: descarta respuestas que llegan tarde. */
  private generacion = 0;

  async iniciar(): Promise<void> {
    const conversacionId = this.sesion.leerConversacionActiva();
    await Promise.all([
      this.cargarConversaciones(),
      conversacionId ? this.cargarHistorial(conversacionId) : Promise.resolve(),
    ]);
  }

  async cargarConversaciones(): Promise<void> {
    this._cargandoConversaciones.set(true);
    this._errorConversaciones.set(null);
    try {
      const remotas = await this.listarConversacionesUseCase.ejecutar();
      // Lo enviado mientras cargaba la lista puede ser mas reciente que la respuesta.
      this._conversaciones.update((locales) => fusionarResumenes(remotas, locales));
    } catch (fallo) {
      this._errorConversaciones.set(aVista(normalizarError(fallo)));
    } finally {
      this._cargandoConversaciones.set(false);
    }
  }

  /** Abre una conversacion del historial y recupera sus mensajes. */
  async abrirConversacion(conversacionId: string): Promise<void> {
    if (conversacionId === this._conversacionId() && !this.conversacionVacia()) {
      return;
    }
    this.reiniciarConversacionActiva();
    this._conversacionId.set(conversacionId);
    this.sesion.guardarConversacionActiva(conversacionId);
    await this.cargarHistorial(conversacionId);
  }

  /** Deja lista una conversacion en blanco; la anterior sigue en el historial. */
  nuevaConversacion(): void {
    this.reiniciarConversacionActiva();
    this.sesion.olvidarConversacionActiva();
  }

  async eliminarConversacion(conversacionId: string): Promise<void> {
    try {
      await this.eliminarConversacionUseCase.ejecutar(conversacionId);
    } catch (fallo) {
      const error = normalizarError(fallo);
      // Si ya no existe en el servidor, el resultado es el mismo que eliminarla.
      if (error.codigo !== 'no-encontrado') {
        this._errorConversaciones.set(aVista(error));
        return;
      }
    }
    this._conversaciones.update((lista) => lista.filter((c) => c.id !== conversacionId));
    if (this._conversacionId() === conversacionId) {
      this.nuevaConversacion();
    }
  }

  async eliminarTodas(): Promise<void> {
    for (const conversacion of this._conversaciones()) {
      await this.eliminarConversacion(conversacion.id);
    }
  }

  async enviar(texto: string): Promise<void> {
    if (!this.puedeEscribir()) {
      return;
    }

    const validacion = validarSolicitud(texto);
    if (!validacion.valida) {
      this.agregar({
        id: this.idLocal(),
        rol: 'aclaracion',
        textoOriginal: texto.trim(),
        mensaje: validacion.mensaje,
      });
      return;
    }

    const provisional: MensajeUsuario = {
      id: this.idLocal(),
      rol: 'usuario',
      turno: this.conteoTurnos() + 1,
      texto: validacion.texto,
      enviadoEn: new Date(),
    };
    this.agregar(provisional);

    const generacion = this.generacion;
    this._esperandoRespuesta.set(true);
    try {
      const resultado = await this.enviarMensajeUseCase.ejecutar({
        conversacionId: this._conversacionId(),
        texto: provisional.texto,
      });
      if (generacion !== this.generacion) {
        return;
      }

      this.reemplazar(provisional.id, [resultado.mensajeUsuario, resultado.respuesta]);
      this._conversacionId.set(resultado.conversacionId);
      this._turnos.set(resultado.turnos);
      this._conversaciones.update((lista) => fusionarResumenes(lista, [resultado.conversacion]));
      this.sesion.guardarConversacionActiva(resultado.conversacionId);

      if (resultado.accionSugerida === 'proponer-ticket') {
        await this.solicitarPropuesta(generacion);
      }
    } catch (fallo) {
      if (generacion !== this.generacion) {
        return;
      }
      const error = normalizarError(fallo);
      if (error.codigo === 'limite-turnos') {
        this.quitar(provisional.id);
        this.marcarLimiteAlcanzado(error);
      } else {
        this.agregar({
          id: this.idLocal(),
          rol: 'error',
          error: aVista(error),
          reintento: {
            accion: 'enviar',
            texto: provisional.texto,
            mensajeProvisionalId: provisional.id,
          },
        });
      }
    } finally {
      if (generacion === this.generacion) {
        this._esperandoRespuesta.set(false);
      }
    }
  }

  async reintentar(avisoId: string): Promise<void> {
    const aviso = this._entradas().find(
      (entrada): entrada is AvisoError => entrada.id === avisoId && entrada.rol === 'error',
    );
    if (!aviso || this._esperandoRespuesta()) {
      return;
    }
    this.quitar(aviso.id);

    const { reintento } = aviso;
    switch (reintento.accion) {
      case 'enviar':
        this.quitar(reintento.mensajeProvisionalId);
        await this.enviar(reintento.texto);
        return;
      case 'proponer-ticket': {
        const generacion = this.generacion;
        this._esperandoRespuesta.set(true);
        try {
          await this.solicitarPropuesta(generacion);
        } finally {
          if (generacion === this.generacion) {
            this._esperandoRespuesta.set(false);
          }
        }
        return;
      }
      case 'cargar-historial':
        await this.cargarHistorial(reintento.conversacionId);
        return;
    }
  }

  /** Solo el boton "Confirmar" llega aqui: ningun texto de la conversacion crea tickets. */
  async confirmarPropuesta(propuestaId: string): Promise<void> {
    const propuesta = this.propuestaResoluble(propuestaId);
    if (!propuesta) {
      return;
    }

    const generacion = this.generacion;
    this.iniciarAccionPropuesta(propuestaId, 'confirmando');
    try {
      const ticket = await this.confirmarTicketUseCase.ejecutar(propuesta);
      if (generacion !== this.generacion) {
        return;
      }
      this.actualizarPropuesta({
        ...propuesta,
        estado: 'confirmada',
        resueltaEn: ticket.creadoEn,
        ticketNumero: ticket.numero,
      });
      this.agregar({
        id: `msg-ticket-${ticket.numero}`,
        rol: 'asistente',
        turno: this.conteoTurnos(),
        clasificacion: null,
        bloques: [{ tipo: 'ticket-creado', ticket }],
        enviadoEn: ticket.creadoEn,
      });
      this.registrarTickets([ticket]);
    } catch (fallo) {
      this.registrarErrorPropuesta(generacion, propuestaId, fallo);
    } finally {
      this.terminarAccionPropuesta(propuestaId);
    }
  }

  async rechazarPropuesta(propuestaId: string): Promise<void> {
    const propuesta = this.propuestaResoluble(propuestaId);
    if (!propuesta) {
      return;
    }

    const generacion = this.generacion;
    this.iniciarAccionPropuesta(propuestaId, 'rechazando');
    try {
      const rechazada = await this.rechazarTicketUseCase.ejecutar(propuesta);
      if (generacion === this.generacion) {
        this.actualizarPropuesta(rechazada);
      }
    } catch (fallo) {
      this.registrarErrorPropuesta(generacion, propuestaId, fallo);
    } finally {
      this.terminarAccionPropuesta(propuestaId);
    }
  }

  async consultarPolitica(cita: CitaPolitica): Promise<void> {
    const clave = claveCita(cita);
    const actual = this._politicas()[clave];
    if (actual?.cargando || actual?.valor) {
      return;
    }

    this._politicas.update((mapa) => ({
      ...mapa,
      [clave]: { cargando: true, valor: null, error: null },
    }));
    try {
      const politica = await this.consultarPoliticaUseCase.ejecutar({
        codigo: cita.codigo,
        version: cita.version,
      });
      this._politicas.update((mapa) => ({
        ...mapa,
        [clave]: { cargando: false, valor: politica, error: null },
      }));
    } catch (fallo) {
      this._politicas.update((mapa) => ({
        ...mapa,
        [clave]: { cargando: false, valor: null, error: aVista(normalizarError(fallo)) },
      }));
    }
  }

  async actualizarEstadoServicio(servicio: AreaServicio): Promise<void> {
    if (this._estadosServicio()[servicio]?.cargando) {
      return;
    }

    this._estadosServicio.update((mapa) => ({
      ...mapa,
      [servicio]: { cargando: true, valor: mapa[servicio]?.valor ?? null, error: null },
    }));
    try {
      const estado = await this.consultarEstadoServicioUseCase.ejecutar(servicio);
      this._estadosServicio.update((mapa) => ({
        ...mapa,
        [servicio]: { cargando: false, valor: estado, error: null },
      }));
    } catch (fallo) {
      this._estadosServicio.update((mapa) => ({
        ...mapa,
        [servicio]: {
          cargando: false,
          valor: mapa[servicio]?.valor ?? null,
          error: aVista(normalizarError(fallo)),
        },
      }));
    }
  }

  private reiniciarConversacionActiva(): void {
    this.generacion += 1;
    this._entradas.set([]);
    this._conversacionId.set(null);
    this._turnos.set(null);
    this._esperandoRespuesta.set(false);
    this._cargandoHistorial.set(false);
    this._accionesPropuesta.set({});
    this._erroresPropuesta.set({});
    this._estadosServicio.set({});
  }

  private async cargarHistorial(conversacionId: string): Promise<void> {
    const generacion = this.generacion;
    this._cargandoHistorial.set(true);
    try {
      const historial = await this.obtenerHistorialUseCase.ejecutar(conversacionId);
      if (generacion !== this.generacion) {
        return;
      }
      this._entradas.set(historial.mensajes);
      this.registrarTickets(
        historial.mensajes.flatMap((mensaje) =>
          mensaje.rol === 'asistente'
            ? mensaje.bloques.flatMap((bloque) =>
                bloque.tipo === 'ticket-creado' ? [bloque.ticket] : [],
              )
            : [],
        ),
      );
      this._conversacionId.set(historial.conversacionId);
      this._turnos.set(historial.turnos);
    } catch (fallo) {
      if (generacion !== this.generacion) {
        return;
      }
      const error = normalizarError(fallo);
      if (error.codigo === 'no-encontrado') {
        // La conversacion ya no existe: se sale de ella sin molestar al usuario.
        this.sesion.olvidarConversacionActiva();
        this._conversacionId.set(null);
        this._conversaciones.update((lista) => lista.filter((c) => c.id !== conversacionId));
      } else {
        this.agregar({
          id: this.idLocal(),
          rol: 'error',
          error: aVista(error),
          reintento: { accion: 'cargar-historial', conversacionId },
        });
      }
    } finally {
      if (generacion === this.generacion) {
        this._cargandoHistorial.set(false);
      }
    }
  }

  private async solicitarPropuesta(generacion: number): Promise<void> {
    const conversacionId = this._conversacionId();
    if (!conversacionId) {
      return;
    }

    try {
      const propuesta = await this.proponerTicketUseCase.ejecutar(conversacionId);
      if (generacion !== this.generacion) {
        return;
      }
      const mensaje: MensajeAsistente = {
        id: `msg-${propuesta.id}`,
        rol: 'asistente',
        turno: this.conteoTurnos(),
        clasificacion: null,
        bloques: [{ tipo: 'propuesta-ticket', propuesta }],
        enviadoEn: propuesta.creadaEn,
      };
      this.agregar(mensaje);
    } catch (fallo) {
      if (generacion === this.generacion) {
        this.agregar({
          id: this.idLocal(),
          rol: 'error',
          error: aVista(normalizarError(fallo)),
          reintento: { accion: 'proponer-ticket' },
        });
      }
    }
  }

  private marcarLimiteAlcanzado(error: ErrorBackend): void {
    const maximos = Number(error.detalles['turnosMaximos']) || this.conteoTurnos();
    this._turnos.set({ usados: maximos, maximos });
  }

  private propuestaResoluble(propuestaId: string): PropuestaTicket | null {
    if (this._accionesPropuesta()[propuestaId]) {
      return null;
    }
    const propuesta = this.buscarPropuesta(propuestaId);
    return propuesta && propuestaPendiente(propuesta) ? propuesta : null;
  }

  private buscarPropuesta(propuestaId: string): PropuestaTicket | null {
    for (const entrada of this._entradas()) {
      if (entrada.rol !== 'asistente') {
        continue;
      }
      for (const bloque of entrada.bloques) {
        if (bloque.tipo === 'propuesta-ticket' && bloque.propuesta.id === propuestaId) {
          return bloque.propuesta;
        }
      }
    }
    return null;
  }

  private actualizarPropuesta(propuesta: PropuestaTicket): void {
    this._entradas.update((entradas) =>
      entradas.map((entrada) =>
        entrada.rol === 'asistente'
          ? {
              ...entrada,
              bloques: entrada.bloques.map((bloque) =>
                bloque.tipo === 'propuesta-ticket' && bloque.propuesta.id === propuesta.id
                  ? { ...bloque, propuesta }
                  : bloque,
              ),
            }
          : entrada,
      ),
    );
  }

  private iniciarAccionPropuesta(propuestaId: string, accion: AccionPropuesta): void {
    this._accionesPropuesta.update((mapa) => ({ ...mapa, [propuestaId]: accion }));
    this._erroresPropuesta.update(({ [propuestaId]: _descartado, ...resto }) => resto);
  }

  private terminarAccionPropuesta(propuestaId: string): void {
    this._accionesPropuesta.update(({ [propuestaId]: _descartado, ...resto }) => resto);
  }

  private registrarErrorPropuesta(generacion: number, propuestaId: string, fallo: unknown): void {
    if (generacion !== this.generacion) {
      return;
    }
    const error = aVista(normalizarError(fallo));
    this._erroresPropuesta.update((mapa) => ({ ...mapa, [propuestaId]: error }));
  }

  /** Agrega o actualiza (por numero) tickets de la sesion, conservando el orden de creacion. */
  private registrarTickets(tickets: readonly Ticket[]): void {
    if (tickets.length === 0) {
      return;
    }
    this._ticketsSesion.update((actuales) => {
      const nuevos = tickets.filter((t) => !actuales.some((a) => a.numero === t.numero));
      const actualizados = actuales.map((a) => tickets.find((t) => t.numero === a.numero) ?? a);
      return [...actualizados, ...nuevos];
    });
  }

  private agregar(entrada: EntradaConversacion): void {
    this._entradas.update((entradas) => [...entradas, entrada]);
  }

  private quitar(id: string): void {
    this._entradas.update((entradas) => entradas.filter((entrada) => entrada.id !== id));
  }

  private reemplazar(id: string, nuevas: readonly EntradaConversacion[]): void {
    this._entradas.update((entradas) =>
      entradas.flatMap((entrada) => (entrada.id === id ? nuevas : [entrada])),
    );
  }

  private idLocal(): string {
    this.secuenciaLocal += 1;
    return `local-${this.secuenciaLocal}`;
  }
}
