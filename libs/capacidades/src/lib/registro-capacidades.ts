import { Inject, Injectable } from '@nestjs/common';
import {
  DEFINICIONES_HERRAMIENTAS,
  type DefinicionHerramienta,
  ValidadorArgumentos,
} from '@unihelp/herramientas';
import type { Capacidad } from './capacidad';
import { BuscarPoliticaCapacidad } from './capacidades/buscar-politica.capacidad';
import { ConfirmarPropuestaCapacidad } from './capacidades/confirmar-propuesta.capacidad';
import { ConsultarEstadoServicioCapacidad } from './capacidades/consultar-estado-servicio.capacidad';
import { CrearTicketSimuladoCapacidad } from './capacidades/crear-ticket-simulado.capacidad';
import { ProponerTicketCapacidad } from './capacidades/proponer-ticket.capacidad';

/** Una capacidad registrada con el contrato que publica. */
export interface CapacidadRegistrada {
  readonly definicion: DefinicionHerramienta;
  readonly capacidad: Capacidad;
}

/**
 * Registro de las capacidades disponibles: nombre, contrato (esquemas y
 * anotaciones de `@unihelp/herramientas`) e implementacion. Arranca con las
 * cinco del contrato y crece de forma ADITIVA con `agregar`: quien registra una
 * herramienta nueva no toca las existentes, y los suscriptores (el servidor MCP,
 * que emite `notifications/tools/list_changed`) se enteran del cambio (HU-27).
 *
 * La sexta herramienta NO existe aqui: su especificacion esta sellada hasta la
 * semana 8. El mecanismo se prueba con una herramienta que solo vive en el
 * entorno de pruebas.
 */
@Injectable()
export class RegistroCapacidades {
  private readonly registradas = new Map<string, CapacidadRegistrada>();
  private readonly suscriptores = new Set<() => void>();

  constructor(
    @Inject(BuscarPoliticaCapacidad) buscar: BuscarPoliticaCapacidad,
    @Inject(ConsultarEstadoServicioCapacidad) estado: ConsultarEstadoServicioCapacidad,
    @Inject(ProponerTicketCapacidad) proponer: ProponerTicketCapacidad,
    @Inject(ConfirmarPropuestaCapacidad) confirmar: ConfirmarPropuestaCapacidad,
    @Inject(CrearTicketSimuladoCapacidad) crear: CrearTicketSimuladoCapacidad,
    @Inject(ValidadorArgumentos) private readonly validador: ValidadorArgumentos,
  ) {
    const porNombre = new Map<string, Capacidad>(
      [buscar, estado, proponer, confirmar, crear].map((c) => [c.nombre, c] as const),
    );
    // El orden de publicacion es el del contrato, no el de inyeccion.
    for (const definicion of DEFINICIONES_HERRAMIENTAS) {
      const capacidad = porNombre.get(definicion.nombre);
      if (capacidad === undefined) {
        throw new Error(`Falta la implementacion de la herramienta «${definicion.nombre}».`);
      }
      this.registradas.set(definicion.nombre, { definicion, capacidad });
    }
  }

  /** Contratos publicados, en orden de registro: el del contrato y luego las agregadas (RM-10). */
  get definiciones(): readonly DefinicionHerramienta[] {
    return [...this.registradas.values()].map((r) => r.definicion);
  }

  capacidad(nombre: string): Capacidad | undefined {
    return this.registradas.get(nombre)?.capacidad;
  }

  definicion(nombre: string): DefinicionHerramienta | undefined {
    return this.registradas.get(nombre)?.definicion;
  }

  /**
   * Agrega una herramienta despues de arrancar. Rechaza un nombre repetido:
   * redefinir una herramienta existente cambiaria el contrato ya publicado.
   */
  agregar(definicion: DefinicionHerramienta, capacidad: Capacidad): void {
    if (this.registradas.has(definicion.nombre)) {
      throw new Error(`La herramienta «${definicion.nombre}» ya esta registrada.`);
    }
    if (definicion.nombre !== capacidad.nombre) {
      throw new Error(
        `La definicion «${definicion.nombre}» y la capacidad «${capacidad.nombre}» no coinciden.`,
      );
    }
    this.validador.registrar(definicion);
    this.registradas.set(definicion.nombre, { definicion, capacidad });
    for (const avisar of this.suscriptores) {
      avisar();
    }
  }

  /** Avisa cada vez que la lista cambia. Devuelve la funcion para darse de baja. */
  alCambiar(suscriptor: () => void): () => void {
    this.suscriptores.add(suscriptor);
    return () => this.suscriptores.delete(suscriptor);
  }
}
