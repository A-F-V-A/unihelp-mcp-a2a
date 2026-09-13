import type { CanalAtencionDto } from '@unihelp/contratos';
import type { IdCanalAtencion } from './tipos';

export const CANALES_ATENCION: Readonly<Record<IdCanalAtencion, CanalAtencionDto>> = {
  'seguridad-campus': {
    nombre: 'Oficina de Seguridad y Movilidad del campus',
    tipo: 'presencial',
    contacto: 'Bloque administrativo, primer piso',
    horario: 'Lunes a viernes, 7:00 a 18:00',
  },
  'atencion-general': {
    nombre: 'Línea de atención general de la universidad',
    tipo: 'telefono',
    contacto: 'Ext. 1000',
    horario: 'Lunes a sábado, 8:00 a 17:00',
  },
  'restaurante-universitario': {
    nombre: 'Restaurante universitario (Bienestar)',
    tipo: 'correo',
    contacto: 'restaurante@unihelp.example',
    horario: null,
  },
};
