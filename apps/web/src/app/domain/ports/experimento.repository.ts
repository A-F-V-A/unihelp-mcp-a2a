import type { IdentificadorArquitectura } from '@unihelp/dominio';
import type {
  ConfiguracionCorrida,
  SaludBackend,
} from '../models/experimento/configuracion-corrida';
import type { CatalogoCorridas, CorridaDetallada } from '../models/experimento/corrida';
import type {
  ManifiestoSalidas,
  ResultadosAnalisis,
} from '../models/experimento/resultados-analisis';
import type { TareaEvaluacion } from '../models/experimento/tarea-evaluacion';

/**
 * Puerto de SOLO LECTURA del panel del experimento (HU-MET-09 a HU-MET-14).
 * No tiene ningun metodo que escriba, lance o modifique nada: lee archivos que
 * ya produjeron el conjunto de tareas, el ejecutor y el cuaderno de analisis.
 * Rechaza solo con `ErrorBackend`; `no-encontrado` significa que el archivo
 * todavia no existe (no se ha corrido nada).
 */
export interface ExperimentoRepository {
  /** Las 40 tareas de docs/tasks, ordenadas por id (RM-10). */
  listarTareas(): Promise<readonly TareaEvaluacion[]>;
  /** Catalogo `corridas/indice.json` que escribe el ejecutor al terminar cada corrida. */
  listarCorridas(): Promise<CatalogoCorridas>;
  /** Trazas, puntuaciones, cuarentena y manifiesto de una corrida. */
  obtenerCorrida(nombre: string): Promise<CorridaDetallada>;
  /** `salidas/resultados.json`. Rechaza con `validacion` si la version del esquema no es la conocida. */
  obtenerResultados(): Promise<ResultadosAnalisis>;
  /** `salidas/manifiesto.json`: figuras y tablas publicadas, con su huella. */
  obtenerManifiestoSalidas(): Promise<ManifiestoSalidas>;
  /** URL desde la que se descarga una salida publicada (figura SVG o tabla CSV). */
  urlSalida(archivo: string): string;
  /** `experiment/ejecutor/corrida.yaml` tal como esta en disco. */
  obtenerConfiguracionCorrida(): Promise<ConfiguracionCorrida>;
  /** `GET /health` del backend de una arquitectura. Es la unica peticion que sale del origen. */
  consultarSalud(arquitectura: IdentificadorArquitectura, url: string): Promise<SaludBackend>;
}
