import type { IdentidadServicio } from '@unihelp/contratos';

/**
 * Identidad de este servicio. Es la unica pieza que cambia entre las apps de
 * backend: el resto del modulo de salud es identico en todas, de modo que las
 * cuatro arquitecturas se comparan con el mismo contrato.
 *
 * Este servicio no pertenece a ninguna arquitectura ni integra agentes: emula
 * los sistemas universitarios cuyo estado consultan las cuatro (decision 33).
 * Por eso su protocolo es `ninguno`: no aporta ningun salto a la medicion.
 */
export const IDENTIDAD: IdentidadServicio = {
  arquitectura: 'COMPARTIDO',
  servicio: 'simulador-servicios',
  rol: 'sistema-emulado',
  protocolo: 'ninguno',
  descripcion:
    'Simulador de los sistemas universitarios: publica el estado de salud del aula virtual, el correo institucional, la autenticacion y la matricula tal como lo declara la tarea en curso.',
  consumidoPor: ['B0', 'B1', 'B2', 'B3'],
  dependencias: ['postgres'],
};

/** Puerto por defecto en ejecucion local (`nx serve simulador-servicios`). */
export const PUERTO_POR_DEFECTO = 3020;
