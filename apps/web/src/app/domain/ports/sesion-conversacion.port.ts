/**
 * Recuerda que conversacion esta activa en esta sesion del navegador, para
 * recuperar su historial al recargar (HU-FE-07). No es un repositorio de
 * backend: vive en el navegador y no depende de la API.
 */
export interface SesionConversacionPort {
  leerConversacionActiva(): string | null;
  guardarConversacionActiva(conversacionId: string): void;
  olvidarConversacionActiva(): void;
}
