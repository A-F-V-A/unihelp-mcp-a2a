/**
 * Recuerda que conversacion esta activa en esta sesion del navegador, para
 * recuperar su historial al recargar (HU-FE-07). No es un repositorio de
 * backend: la misma implementacion sirve con datos simulados o reales.
 */
export interface SesionConversacionPort {
  leerConversacionActiva(): string | null;
  guardarConversacionActiva(conversacionId: string): void;
  olvidarConversacionActiva(): void;
}
