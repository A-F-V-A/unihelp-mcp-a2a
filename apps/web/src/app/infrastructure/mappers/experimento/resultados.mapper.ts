import { type IdentificadorArquitectura, esIdentificadorArquitectura } from '@unihelp/dominio';
import { ErrorBackend } from '../../../domain/errors/error-backend';
import type { ConfiguracionCorrida } from '../../../domain/models/experimento/configuracion-corrida';
import { MODOS_LLM, type ModoLlm } from '../../../domain/models/experimento/corrida';
import {
  type ContrasteMetrica,
  type DireccionMetrica,
  type EstadoMetrica,
  FAMILIAS_METRICA,
  type FamiliaMetrica,
  type FilaMetrica,
  type ManifiestoSalidas,
  type MetricaResultado,
  type OperadorUmbral,
  ROLES_METRICA,
  type ResultadosAnalisis,
  type RolMetrica,
  type TipoValorEsperado,
  type UmbralMetrica,
  VERSION_RESULTADOS_CONOCIDA,
} from '../../../domain/models/experimento/resultados-analisis';
import type {
  ContrasteDto,
  FilaDto,
  ManifiestoSalidasDto,
  MetricaDto,
  ResultadosDto,
  UmbralDto,
} from '../../estaticos/experimento.dto';

/**
 * `resultados.json` -> modelo. Si la version del esquema no es la que el panel
 * conoce, rechaza: el panel lo declara en vez de mostrar datos parciales
 * (HU-MET-09). Una metrica de resultado abierto llega sin `umbral` y asi se
 * conserva: el panel no le inventa uno (HU-MET-03).
 */
export function mapearResultados(dto: ResultadosDto): ResultadosAnalisis {
  if (dto.version_esquema_resultados !== VERSION_RESULTADOS_CONOCIDA) {
    throw new ErrorBackend(
      'validacion',
      `El archivo de resultados usa el esquema ${dto.version_esquema_resultados} y este panel conoce ${VERSION_RESULTADOS_CONOCIDA}. No se muestran datos parciales.`,
      { versionArchivo: dto.version_esquema_resultados, versionPanel: VERSION_RESULTADOS_CONOCIDA },
    );
  }
  return {
    versionEsquema: dto.version_esquema_resultados,
    generadoEn: new Date(dto.generado_en),
    corrida: {
      semilla: dto.corrida.semilla,
      versionCodigo: dto.corrida.version_codigo,
      modeloId: dto.corrida.modelo_id,
      versionRegistro: dto.corrida.version_registro,
      versionEsquemaTraza: dto.corrida.version_esquema_traza,
      arquitecturas: dto.corrida.arquitecturas.filter(esIdentificadorArquitectura),
      tareasTotal: dto.corrida.tareas.total,
      tareasPorCategoria: { ...dto.corrida.tareas.por_categoria },
      ejecuciones: {
        intentadas: dto.corrida.ejecuciones.intentadas,
        validas: dto.corrida.ejecuciones.validas,
        invalidas: dto.corrida.ejecuciones.invalidas,
        porMotivo: { ...dto.corrida.ejecuciones.por_motivo },
      },
      inferencia: {
        tamanoMuestra: dto.corrida.inferencia.tamano_muestra,
        metodo: dto.corrida.inferencia.metodo,
        replicas: dto.corrida.inferencia.replicas,
        nivel: dto.corrida.inferencia.nivel,
        semilla: dto.corrida.inferencia.semilla,
      },
    },
    validacion: {
      umbralAvisoResiduo: dto.validacion.umbral_aviso_residuo,
      avisosResiduo: dto.validacion.avisos_residuo.map((aviso) => ({ ...aviso })),
      rechazos: dto.validacion.rechazos.map((rechazo) => ({
        origen: rechazo.origen,
        ejecucion: rechazo.ejecucion,
        motivos: [...rechazo.motivos],
        detalle: [...rechazo.detalle],
      })),
    },
    metricas: dto.metricas.map(mapearMetrica),
  };
}

export function mapearMetrica(dto: MetricaDto): MetricaResultado {
  const tipo: TipoValorEsperado =
    dto.tipo_valor_esperado === 'umbral' ? 'umbral' : 'resultado_abierto';
  return {
    codigo: dto.codigo,
    familia: familia(dto.familia),
    nombre: dto.nombre,
    rol: rol(dto.rol),
    hipotesis: [...dto.hipotesis],
    tipoValorEsperado: tipo,
    unidad: dto.unidad,
    direccion: direccion(dto.direccion),
    unidadAnalisis: dto.unidad_analisis,
    estado: estado(dto.estado),
    motivoEstado: dto.motivo_estado,
    filas: dto.filas.map(mapearFila),
    contrastes: dto.contrastes.map(mapearContraste),
    notas: [...dto.notas],
    umbral: tipo === 'umbral' && dto.umbral ? mapearUmbral(dto.umbral) : null,
  };
}

function mapearFila(dto: FilaDto): FilaMetrica {
  return {
    arquitectura: esIdentificadorArquitectura(dto.arquitectura) ? dto.arquitectura : null,
    dimensiones: { ...dto.dimensiones },
    estadistico: dto.estadistico,
    valor: dto.valor,
    intervalo: dto.intervalo ? { ...dto.intervalo } : null,
    nTareas: dto.n_tareas,
    nObservaciones: dto.n_observaciones,
  };
}

function mapearContraste(dto: ContrasteDto): ContrasteMetrica {
  return {
    minuendo: arquitectura(dto.minuendo),
    sustraendo: arquitectura(dto.sustraendo),
    dimensiones: { ...dto.dimensiones },
    estadistico: dto.estadistico,
    diferencia: dto.diferencia,
    intervalo: dto.intervalo ? { ...dto.intervalo } : null,
    nTareas: dto.n_tareas,
  };
}

function mapearUmbral(dto: UmbralDto): UmbralMetrica {
  return {
    operador: dto.operador as OperadorUmbral,
    valor: dto.valor ?? null,
    arquitecturas: dto.arquitecturas ? dto.arquitecturas.filter(esIdentificadorArquitectura) : null,
    alcance: dto.alcance ?? null,
    descripcion: dto.descripcion,
    consecuencia: dto.consecuencia ?? null,
    observado:
      dto.observado !== null && typeof dto.observado === 'object'
        ? { ...dto.observado }
        : dto.observado,
    alcanza: dto.alcanza,
  };
}

export function mapearManifiestoSalidas(dto: ManifiestoSalidasDto): ManifiestoSalidas {
  return {
    resultadosSha256: dto.resultados.sha256_sin_marca_tiempo,
    salidas: dto.salidas.map((salida) => ({
      etiqueta: salida.etiqueta,
      archivo: salida.archivo,
      sha256: salida.sha256,
      tipo: salida.etiqueta.startsWith('figura') ? 'figura' : 'tabla',
    })),
  };
}

/** `corrida.yaml` ya parseado. Los valores por defecto son los de `configuracion.py`. */
export function mapearConfiguracionCorrida(crudo: unknown): ConfiguracionCorrida {
  const datos = esObjeto(crudo) ? crudo : {};
  const corrida = esObjeto(datos['corrida']) ? datos['corrida'] : {};
  const tarifa = esObjeto(datos['tarifa_usd_por_millon']) ? datos['tarifa_usd_por_millon'] : {};
  const limites = esObjeto(datos['limites']) ? datos['limites'] : {};
  const compuerta = esObjeto(datos['compuerta']) ? datos['compuerta'] : {};
  const backendsCrudos = esObjeto(datos['backends']) ? datos['backends'] : {};
  const entrada = numero(tarifa['entrada'], 0);
  const salida = numero(tarifa['salida'], 0);
  const backends: Partial<Record<IdentificadorArquitectura, string>> = {};
  for (const [clave, valor] of Object.entries(backendsCrudos)) {
    if (esIdentificadorArquitectura(clave) && typeof valor === 'string') {
      backends[clave] = valor.replace(/\/+$/, '');
    }
  }
  const tareas = Array.isArray(corrida['tareas']) ? corrida['tareas'].map(String) : null;
  const modo = corrida['modo_llm'];
  return {
    semilla: numero(corrida['semilla'], 0),
    repeticiones: numero(corrida['repeticiones'], 1),
    arquitecturas: (Array.isArray(corrida['arquitecturas'])
      ? corrida['arquitecturas']
      : ['B0']
    ).filter(esIdentificadorArquitectura),
    tareas,
    modoLlm:
      typeof modo === 'string' && (MODOS_LLM as readonly string[]).includes(modo)
        ? (modo as ModoLlm)
        : 'record',
    backends,
    tarifaUsdPorMillon: { entrada, salida, configurada: entrada > 0 || salida > 0 },
    timeoutHttpS: numero(limites['timeout_http_s'], 180),
    verificarFidelidadCitacion: compuerta['verificar_fidelidad_citacion'] !== false,
    datasetVersion: String(datos['dataset_version'] ?? '1.0'),
  };
}

function familia(valor: string): FamiliaMetrica {
  return (FAMILIAS_METRICA as readonly string[]).includes(valor) ? (valor as FamiliaMetrica) : 'M1';
}

function rol(valor: string): RolMetrica {
  return (ROLES_METRICA as readonly string[]).includes(valor)
    ? (valor as RolMetrica)
    : 'descriptiva';
}

function direccion(valor: string): DireccionMetrica {
  return valor === 'mayor_es_mejor' || valor === 'menor_es_mejor' ? valor : 'sin_direccion';
}

function estado(valor: string): EstadoMetrica {
  return valor === 'calculada' || valor === 'sin_datos' ? valor : 'pendiente';
}

function arquitectura(valor: string): IdentificadorArquitectura {
  if (!esIdentificadorArquitectura(valor)) {
    throw new ErrorBackend('validacion', `Arquitectura desconocida en un contraste: «${valor}».`);
  }
  return valor;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function numero(valor: unknown, porDefecto: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto;
}
