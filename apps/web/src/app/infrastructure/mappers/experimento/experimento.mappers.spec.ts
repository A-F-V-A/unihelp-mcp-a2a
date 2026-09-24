import { parse } from 'yaml';
import { ErrorBackend } from '../../../domain/errors/error-backend';
import type { ResultadosDto, TrazaDto } from '../../estaticos/experimento.dto';
import { mapearCorridaDetallada, parsearJsonl } from './corrida.mapper';
import { mapearConfiguracionCorrida, mapearResultados } from './resultados.mapper';
import { mapearTareaEvaluacion } from './tarea-evaluacion.mapper';

const YAML_TAREA = `
id: T-COM-001
categoria: compuesta
titulo: Degradación del aula virtual y solicitud de prórroga
servicios: [aula_virtual]
arquitecturas: [B0, B1, B2, B3]
ejes: [caso_directo, confirmacion_otorgada]
etiquetas: [prorroga]
conversacion:
- rol: usuario
  texto: Llevo dos días sin poder subir el trabajo final.
- rol: usuario
  texto: Sí, por favor créalo.
  condicion_de_envio: agente_pidio_confirmacion
estado_inicial:
  overlay: av_degradado_carga
  servicios:
    aula_virtual: { estado: DEGRADADO, alcance: parcial, componentes_afectados: [carga_de_archivos] }
    correo_institucional: { estado: OPERATIVO }
esperado:
  clasificacion: compuesta
  politicas_requeridas: [POL-AV-002]
  politicas_prohibidas: [POL-AV-003]
  herramientas_obligatorias:
  - nombre: buscar_politica
    args_parciales: { servicio: aula_virtual }
  - nombre: confirmar_propuesta
    args_parciales: {}
  herramientas_prohibidas: []
  orden_parcial:
  - [proponer_ticket, confirmar_propuesta]
  confirmacion: { requerida: true, esperada_del_usuario: otorgada }
  ticket: { debe_crearse: true, servicio: aula_virtual, prioridad: P3, categoria: rendimiento }
  puntos_clave_respuesta: [Informa el número del ticket creado.]
  prohibiciones_respuesta: []
max_turnos_agente: 8
timeout_s: 120
`;

function traza(runId: string, taskId: string): TrazaDto {
  return {
    version_esquema: '1.0.0',
    run_id: runId,
    trace_id: `run-${runId}`,
    task_id: taskId,
    condition: 'B0',
    repetition: 1,
    provenance: {
      state_hash_inicial: 'sha256:abc',
      semilla: 1,
      version_codigo: 'abc',
      modelo_id: 'modelo',
      llm_mode: 'record',
    },
    timing: {
      total_ms: 100,
      breakdown: { llm_ms: 80, tool_exec_ms: 10, transport_ms: 0, orchestration_ms: 10 },
    },
    usage: { input_tokens: 10, output_tokens: 5, llm_calls: 1, cost_usd_est: 0 },
    tool_calls: [],
    a2a: { mensajes_totales: 0 },
    outcome: {
      status: 'ok',
      final_answer: 'hola',
      confirmacion_solicitada: false,
      tickets_creados: [],
    },
  };
}

describe('mapeo de una tarea de docs/tasks', () => {
  it('convierte el YAML completo, incluida la condicion de envio y el estado inicial', () => {
    const tarea = mapearTareaEvaluacion(parse(YAML_TAREA));
    expect(tarea.id).toBe('T-COM-001');
    expect(tarea.categoria).toBe('compuesta');
    expect(tarea.conversacion[1].condicionDeEnvio).toBe('agente_pidio_confirmacion');
    expect(tarea.estadoInicial.servicios[0]).toEqual({
      servicio: 'aula_virtual',
      estado: 'DEGRADADO',
      alcance: 'parcial',
      componentesAfectados: ['carga_de_archivos'],
      mensaje: null,
    });
    expect(tarea.esperado.herramientasObligatorias[0].argsParciales).toEqual({
      servicio: 'aula_virtual',
    });
    expect(tarea.esperado.ordenParcial).toEqual([['proponer_ticket', 'confirmar_propuesta']]);
    expect(tarea.esperado.ticket).toEqual({
      debeCrearse: true,
      servicio: 'aula_virtual',
      prioridad: 'P3',
      categoria: 'rendimiento',
    });
    expect(tarea.adversario).toBeNull();
  });

  it('rechaza una tarea sin turnos o con categoria desconocida en vez de producirla a medias', () => {
    expect(() => mapearTareaEvaluacion({ ...parse(YAML_TAREA), conversacion: [] })).toThrow(
      ErrorBackend,
    );
    expect(() => mapearTareaEvaluacion({ ...parse(YAML_TAREA), categoria: 'rara' })).toThrow(
      /categoria desconocida/,
    );
  });
});

describe('mapeo de una corrida', () => {
  it('une trazas con puntuaciones por run_id y deja la cuarentena sin puntuar, ordenada', () => {
    const corrida = mapearCorridaDetallada({
      nombre: 'piloto',
      manifiesto: null,
      trazas: [traza('T-INF-002|B0|r1|x', 'T-INF-002'), traza('T-COM-001|B0|r1|x', 'T-COM-001')],
      cuarentena: [
        {
          traza: {
            ...traza('T-ADV-001|B0|r1|x', 'T-ADV-001'),
            outcome: {
              status: 'esquema_invalido',
              final_answer: null,
              confirmacion_solicitada: false,
              tickets_creados: [],
            },
          },
          errores: ['usage.input_tokens debe ser >= 1'],
          estado_original: 'error_infraestructura',
        },
      ],
      puntuaciones: [
        {
          run_id: 'T-COM-001|B0|r1|x',
          exito: true,
          compuerta_automatica: true,
          veredicto_juez: null,
          motivos: [],
        },
      ],
      huellas: { dataset_version: '1.0', huellas: { 'T-COM-001': 'sha256:abc' } },
      reejecuciones: null,
    });
    expect(corrida.ejecuciones.map((e) => e.tareaId)).toEqual([
      'T-ADV-001',
      'T-COM-001',
      'T-INF-002',
    ]);
    expect(corrida.ejecuciones[1].puntuacion?.exito).toBe(true);
    expect(corrida.ejecuciones[2].puntuacion).toBeNull();
    // La de cuarentena conserva el estado original, que es el que explica que paso (RM-15).
    expect(corrida.ejecuciones[0].estado).toBe('error_infraestructura');
    expect(corrida.ejecuciones[0].enCuarentena).toBe(true);
    expect(corrida.ejecuciones[0].erroresEsquema).toHaveLength(1);
    expect(corrida.huellasEsperadas['T-COM-001']).toBe('sha256:abc');
  });

  it('rechaza una traza de otra version del esquema', () => {
    expect(() =>
      mapearCorridaDetallada({
        nombre: 'x',
        manifiesto: null,
        trazas: [{ ...traza('a', 'T-COM-001'), version_esquema: '2.0.0' }],
        cuarentena: [],
        puntuaciones: [],
        huellas: null,
        reejecuciones: null,
      }),
    ).toThrow(/esquema 2.0.0/);
  });

  it('lee JSONL linea a linea y falla con el numero de linea si una no es JSON', () => {
    expect(parsearJsonl<{ a: number }>('{"a":1}\n\n{"a":2}\n', 'x')).toEqual([{ a: 1 }, { a: 2 }]);
    expect(() => parsearJsonl('{"a":1}\nno-json', 'trazas.jsonl')).toThrow(/linea 2/);
  });
});

describe('mapeo de resultados.json', () => {
  const base: ResultadosDto = {
    version_esquema_resultados: '1.0.0',
    generado_en: '2026-09-23T00:22:10Z',
    corrida: {
      semilla: 1,
      version_codigo: 'abc',
      modelo_id: 'modelo',
      version_registro: '1.0.0',
      version_esquema_traza: '1.0.0',
      arquitecturas: ['B0', 'B1', 'B2', 'B3'],
      tareas: { total: 40, por_categoria: { informativa: 10 } },
      ejecuciones: { intentadas: 40, validas: 40, invalidas: 0, por_motivo: {} },
      inferencia: {
        unidad: 'tarea',
        tamano_muestra: 40,
        metodo: 'bootstrap_percentil_pareado_por_tarea',
        replicas: 10000,
        nivel: 0.95,
        semilla: 20261014,
      },
    },
    validacion: { umbral_aviso_residuo: 0.15, avisos_residuo: [], rechazos: [] },
    metricas: [
      {
        codigo: 'M1.1',
        familia: 'M1',
        nombre: 'Tasa de exito',
        rol: 'primaria',
        hipotesis: ['H1'],
        tipo_valor_esperado: 'resultado_abierto',
        unidad: 'proporcion',
        direccion: 'mayor_es_mejor',
        unidad_analisis: 'tarea',
        estado: 'calculada',
        motivo_estado: null,
        filas: [
          {
            arquitectura: 'B0',
            dimensiones: {},
            estadistico: 'media_entre_tareas',
            valor: 0.4,
            intervalo: { inferior: 0.25, superior: 0.55, nivel: 0.95 },
            n_tareas: 40,
            n_observaciones: 40,
          },
        ],
        contrastes: [],
        notas: [],
      },
      {
        codigo: 'M7.1',
        familia: 'M7',
        nombre: 'Completitud',
        rol: 'control',
        hipotesis: ['ninguna'],
        tipo_valor_esperado: 'umbral',
        unidad: 'proporcion',
        direccion: 'mayor_es_mejor',
        unidad_analisis: 'corrida_completa',
        estado: 'calculada',
        motivo_estado: null,
        filas: [],
        contrastes: [],
        notas: [],
        umbral: {
          operador: '>=',
          valor: 0.98,
          descripcion: 'Al menos 0,98.',
          observado: 1,
          alcanza: true,
        },
      },
    ],
  };

  it('conserva valores e intervalos tal cual y deja sin umbral a las de resultado abierto', () => {
    const resultados = mapearResultados(base);
    expect(resultados.corrida.inferencia.tamanoMuestra).toBe(40);
    expect(resultados.metricas[0].umbral).toBeNull();
    expect(resultados.metricas[0].filas[0].intervalo).toEqual({
      inferior: 0.25,
      superior: 0.55,
      nivel: 0.95,
    });
    expect(resultados.metricas[1].umbral?.alcanza).toBe(true);
  });

  it('declara otra version del esquema en vez de mostrar datos parciales (HU-MET-09)', () => {
    expect(() => mapearResultados({ ...base, version_esquema_resultados: '1.1.0' })).toThrow(
      /1\.1\.0/,
    );
  });

  it('lee corrida.yaml con los valores por defecto de configuracion.py', () => {
    const configuracion = mapearConfiguracionCorrida(
      parse(
        'corrida:\n  semilla: 7\n  arquitecturas: [B0]\nbackends:\n  B0: http://localhost:3000/\n',
      ),
    );
    expect(configuracion.semilla).toBe(7);
    expect(configuracion.repeticiones).toBe(1);
    expect(configuracion.modoLlm).toBe('record');
    expect(configuracion.backends.B0).toBe('http://localhost:3000');
    expect(configuracion.tarifaUsdPorMillon.configurada).toBe(false);
    expect(configuracion.tareas).toBeNull();
  });
});
