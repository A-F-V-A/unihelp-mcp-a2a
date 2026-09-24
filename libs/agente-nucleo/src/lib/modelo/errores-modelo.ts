import { ErrorInfraestructura } from '@unihelp/herramientas';

/**
 * Fallo que no es de la arquitectura: el proveedor no respondio, limito la tasa
 * o falta la grabacion en un casete. Se trata como `error_infraestructura` y se
 * reejecuta, nunca cuenta como fallo del agente (RM-15; DP-17 provisional).
 */
export class ErrorInfraestructuraModelo extends ErrorInfraestructura {}

/** Se agoto el presupuesto de tiempo durante una peticion al modelo (RNF-04). */
export class ErrorTiempoAgotado extends Error {
  constructor() {
    super('Se agotó el tiempo de procesamiento de la conversación.');
    this.name = 'ErrorTiempoAgotado';
  }
}
