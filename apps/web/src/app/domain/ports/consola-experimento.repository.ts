import type { SeleccionCorrida } from '../rules/experimento/comando-corrida.rules';
import type { EstadoConsola, EventoTrabajo, Trabajo } from '../models/experimento/trabajo-consola';

/**
 * Puerto de la consola del experimento (`apps/consola-experimento`): el unico
 * lugar desde el que el panel LANZA algo (decision 39). Esta separado del
 * puerto de lectura `ExperimentoRepository` a proposito: lo que muestra el
 * panel sigue saliendo de archivos, y lo que lanza pasa por aqui y por nada
 * mas. Rechaza solo con `ErrorBackend`; `sin-conexion` significa que la
 * consola no esta levantada y el panel queda en solo lectura.
 */
export interface ConsolaExperimentoRepository {
  /** Trabajo en marcha o el ultimo terminado, y con que ejecutable trabaja la consola. */
  estado(): Promise<EstadoConsola>;
  /** Lanza `ejecutor correr` con la seleccion; rechaza con `conflicto` si ya hay uno en marcha. */
  lanzarCorrida(seleccion: SeleccionCorrida): Promise<Trabajo>;
  /** Corre el cuaderno sobre una corrida existente y reescribe `salidas/`. */
  lanzarAnalisis(corrida: string): Promise<Trabajo>;
  cancelar(trabajoId: string): Promise<Trabajo>;
  /**
   * Sigue un trabajo en vivo: entrega lo ya emitido y luego cada linea nueva,
   * termina con el evento `fin`. Devuelve la funcion que corta la suscripcion.
   */
  seguir(trabajoId: string, alRecibir: (evento: EventoTrabajo) => void): () => void;
}
