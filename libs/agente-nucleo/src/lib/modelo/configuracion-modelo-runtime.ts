import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  ConfiguracionModeloIaDto,
  ProveedorModeloDto,
  SeleccionModeloIaDto,
} from '@unihelp/contratos';
import { PROVEEDORES_MODELO, type ProveedorModelo, esProveedorModelo } from '@unihelp/dominio';
import {
  CONFIGURACION_AGENTE,
  type ConfiguracionAgente,
} from '../configuracion/configuracion-agente';
import { ErrorApi } from '../http/error-api';

/** Fichas de los proveedores que la interfaz muestra. B0 solo implementa OpenAI (decision 27). */
const FICHAS: Readonly<Record<ProveedorModelo, { nombre: string; descripcion: string }>> = {
  chatgpt: { nombre: 'ChatGPT', descripcion: 'Modelos GPT de OpenAI.' },
  gemini: { nombre: 'Gemini', descripcion: 'Modelos Gemini de Google.' },
  claude: { nombre: 'Claude', descripcion: 'Modelos Claude de Anthropic.' },
  local: {
    nombre: 'Agente local',
    descripcion: 'Un agente propio, alcanzable por una URL y autenticado con un token.',
  },
};

const NO_IMPLEMENTADO = 'B0 todavía no integra este proveedor; por ahora solo responde OpenAI.';
const SIN_CLAVE = 'Falta la clave del proveedor en el servidor (OPENAI_API_KEY).';
const EN_REPRODUCCION =
  'En modo de reproducción el modelo no se puede cambiar: los casetes están grabados con uno concreto.';

/**
 * Eleccion de proveedor y modelo vigente en ESTE proceso. Existe para que la
 * pantalla de configuracion sirva de verdad sin que la clave salga del servidor
 * (decision 27): la interfaz elige entre lo que aqui se declara disponible.
 *
 * Una corrida del experimento NO usa esta eleccion: `modeloVigente` devuelve el
 * de la configuracion cuando la peticion viene del ejecutor, para que las cuatro
 * arquitecturas midan con el mismo modelo (RNF-01) y la traza registre uno solo
 * (RNF-08).
 */
@Injectable()
export class ConfiguracionModeloRuntime {
  private readonly logger = new Logger('ModeloIA');
  private seleccion: SeleccionModeloIaDto;

  constructor(@Inject(CONFIGURACION_AGENTE) private readonly configuracion: ConfiguracionAgente) {
    this.seleccion = { proveedor: 'chatgpt', modelo: configuracion.modelo.id };
  }

  /** Modelo que debe usar este turno. El ejecutor del experimento manda sobre la interfaz. */
  modeloVigente(esEjecucionDelExperimento: boolean): string {
    return esEjecucionDelExperimento ? this.configuracion.modelo.id : this.seleccion.modelo;
  }

  estado(): ConfiguracionModeloIaDto {
    const proveedores = PROVEEDORES_MODELO.map((id) => this.ficha(id));
    const elegido = proveedores.find((p) => p.id === this.seleccion.proveedor);
    return {
      proveedores,
      seleccion: this.seleccion,
      claveConfigurada: elegido?.disponible ?? false,
      editable: this.configuracion.modoLlm !== 'replay',
    };
  }

  /** @throws ErrorApi `validacion` si el proveedor o el modelo no estan admitidos. */
  seleccionar(cuerpo: unknown): ConfiguracionModeloIaDto {
    if (!this.estado().editable) {
      throw new ErrorApi('conflicto', EN_REPRODUCCION);
    }
    const datos = (cuerpo ?? {}) as Record<string, unknown>;
    const proveedor = datos['proveedor'];
    if (!esProveedorModelo(proveedor)) {
      throw new ErrorApi('validacion', 'Elige un proveedor de la lista.', { campo: 'proveedor' });
    }
    const ficha = this.ficha(proveedor);
    if (!ficha.disponible) {
      throw new ErrorApi('validacion', ficha.motivoNoDisponible ?? NO_IMPLEMENTADO, {
        campo: 'proveedor',
      });
    }
    const pedido = typeof datos['modelo'] === 'string' ? datos['modelo'].trim() : '';
    const modelo = pedido === '' ? (ficha.modeloPorDefecto ?? '') : pedido;
    if (!ficha.modelos.includes(modelo)) {
      throw new ErrorApi(
        'validacion',
        `El modelo «${modelo}» no está habilitado en el servidor. Disponibles: ${ficha.modelos.join(', ')}.`,
        { campo: 'modelo' },
      );
    }

    this.seleccion = { proveedor, modelo };
    this.logger.log(`Modelo elegido desde la interfaz: ${proveedor} / ${modelo}`);
    return this.estado();
  }

  private ficha(id: ProveedorModelo): ProveedorModeloDto {
    const { nombre, descripcion } = FICHAS[id];
    if (id !== 'chatgpt') {
      return {
        id,
        nombre,
        descripcion,
        disponible: false,
        motivoNoDisponible: NO_IMPLEMENTADO,
        modelos: [],
        modeloPorDefecto: null,
      };
    }
    // En reproduccion no hace falta clave: las respuestas salen de los casetes (HU-44).
    const conClave =
      this.configuracion.claveApi !== null || this.configuracion.modoLlm === 'replay';
    return {
      id,
      nombre,
      descripcion,
      disponible: conClave,
      motivoNoDisponible: conClave ? null : SIN_CLAVE,
      modelos: this.configuracion.modelosPermitidos,
      modeloPorDefecto: this.configuracion.modelo.id,
    };
  }
}
