import type { AreaServicio } from '@unihelp/dominio';
import type { EstadoServicioFixture } from './tipos';

/**
 * Un estado por area de servicio, cubriendo los cuatro niveles y los dos casos
 * de ventana: con estimacion y sin ella.
 */
export const ESTADOS_SERVICIO: Readonly<Record<AreaServicio, EstadoServicioFixture>> = {
  'plataforma-virtual': {
    servicio: 'plataforma-virtual',
    nombre: 'Aula virtual (Moodle)',
    estado: 'degradado',
    componenteAfectado: 'Módulo de entrega de tareas',
    alcance: 'Estudiantes y docentes de pregrado con entregas activas',
    ventanaRelativaMin: { inicio: -40, fin: 80 },
    incidenteId: 'INC-2026-0419',
    actualizadoHaceMin: 6,
  },
  'soporte-tecnico': {
    servicio: 'soporte-tecnico',
    nombre: 'Correo institucional',
    estado: 'interrumpido',
    componenteAfectado: 'Servidor de correo saliente (SMTP)',
    alcance: 'Todas las cuentas institucionales: no se pueden enviar mensajes',
    // Sin estimacion: la UI debe decirlo explicitamente (HU-FE-14).
    ventanaRelativaMin: null,
    incidenteId: 'INC-2026-0421',
    actualizadoHaceMin: 3,
  },
  biblioteca: {
    servicio: 'biblioteca',
    nombre: 'Catálogo y préstamos en línea',
    estado: 'mantenimiento',
    componenteAfectado: 'Sistema de gestión bibliotecaria',
    alcance: 'Renovaciones y reservas en línea. El préstamo presencial sigue disponible.',
    ventanaRelativaMin: { inicio: 120, fin: 480 },
    incidenteId: null,
    actualizadoHaceMin: 60,
  },
  financiera: {
    servicio: 'financiera',
    nombre: 'Pagos en línea (PSE)',
    estado: 'degradado',
    componenteAfectado: 'Pasarela de pagos PSE',
    alcance: 'Pagos de matrícula y derechos pecuniarios en línea',
    ventanaRelativaMin: { inicio: -15, fin: 105 },
    incidenteId: 'INC-2026-0423',
    actualizadoHaceMin: 10,
  },
  'registro-academico': {
    servicio: 'registro-academico',
    nombre: 'Portal estudiantil',
    estado: 'operativo',
    componenteAfectado: null,
    alcance: null,
    ventanaRelativaMin: null,
    incidenteId: null,
    actualizadoHaceMin: 2,
  },
  'infraestructura-fisica': {
    servicio: 'infraestructura-fisica',
    nombre: 'Red inalámbrica del campus',
    estado: 'operativo',
    componenteAfectado: null,
    alcance: null,
    ventanaRelativaMin: null,
    incidenteId: null,
    actualizadoHaceMin: 4,
  },
  'bienestar-universitario': {
    servicio: 'bienestar-universitario',
    nombre: 'Agendamiento de citas de bienestar',
    estado: 'operativo',
    componenteAfectado: null,
    alcance: null,
    ventanaRelativaMin: null,
    incidenteId: null,
    actualizadoHaceMin: 15,
  },
};
