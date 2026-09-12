/**
 * Vocabulario de dominio del triaje de incidentes universitarios.
 *
 * Esta capa define UNICAMENTE los tipos y catalogos compartidos. La logica de
 * triaje (clasificacion, enrutamiento, priorizacion automatica) se implementa
 * mas adelante y de forma separada en cada arquitectura, porque es justamente
 * lo que el experimento compara.
 */

/** Prioridad asignada a un incidente, de mayor a menor urgencia. */
export const PRIORIDADES = ['critica', 'alta', 'media', 'baja'] as const;

export type Prioridad = (typeof PRIORIDADES)[number];

/** Estados del ciclo de vida de un incidente. */
export const ESTADOS_INCIDENTE = [
  'recibido',
  'en-triaje',
  'asignado',
  'en-atencion',
  'resuelto',
  'cerrado',
  'rechazado',
] as const;

export type EstadoIncidente = (typeof ESTADOS_INCIDENTE)[number];

/** Areas de servicio universitario a las que se puede enrutar un incidente. */
export const AREAS_SERVICIO = [
  'registro-academico',
  'plataforma-virtual',
  'soporte-tecnico',
  'biblioteca',
  'bienestar-universitario',
  'financiera',
  'infraestructura-fisica',
] as const;

export type AreaServicio = (typeof AREAS_SERVICIO)[number];

/** Ficha de un area de servicio: a quien pertenece y en cuanto se compromete. */
export interface DescriptorAreaServicio {
  readonly id: AreaServicio;
  readonly nombre: string;
  readonly dependencia: string;
}

export const CATALOGO_AREAS_SERVICIO: Readonly<Record<AreaServicio, DescriptorAreaServicio>> = {
  'registro-academico': {
    id: 'registro-academico',
    nombre: 'Registro academico',
    dependencia: 'Secretaria Academica',
  },
  'plataforma-virtual': {
    id: 'plataforma-virtual',
    nombre: 'Plataforma virtual de aprendizaje',
    dependencia: 'Direccion de Educacion Virtual',
  },
  'soporte-tecnico': {
    id: 'soporte-tecnico',
    nombre: 'Soporte tecnico y cuentas',
    dependencia: 'Division de Sistemas',
  },
  biblioteca: {
    id: 'biblioteca',
    nombre: 'Servicios de biblioteca',
    dependencia: 'Biblioteca Central',
  },
  'bienestar-universitario': {
    id: 'bienestar-universitario',
    nombre: 'Bienestar universitario',
    dependencia: 'Direccion de Bienestar',
  },
  financiera: {
    id: 'financiera',
    nombre: 'Gestion financiera y pagos',
    dependencia: 'Division Financiera',
  },
  'infraestructura-fisica': {
    id: 'infraestructura-fisica',
    nombre: 'Infraestructura fisica y planta',
    dependencia: 'Division de Planta Fisica',
  },
};
