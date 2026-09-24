import type { EjecucionCorrida } from '../../models/experimento/corrida';
import type { MetricaResultado } from '../../models/experimento/resultados-analisis';
import type { TareaEvaluacion } from '../../models/experimento/tarea-evaluacion';
import {
  compactarTareas,
  construirComandoCorrida,
  validarSeleccionCorrida,
} from './comando-corrida.rules';
import {
  agruparPorTarea,
  filtrarEjecuciones,
  interpretarMotivo,
  ordenarEjecuciones,
  veredictoEjecucion,
} from './ejecuciones.rules';
import { barrasLatencia, puntosEfectividad } from './graficas.rules';
import { admiteSemaforo, estadoSemaforo, resumirSemaforo } from './semaforo.rules';
import { filtrarTareas, valoresDistintos } from './tareas.rules';

function tarea(id: string, categoria: TareaEvaluacion['categoria']): TareaEvaluacion {
  return {
    id,
    categoria,
    titulo: `Tarea ${id}`,
    servicios: categoria === 'informativa' ? [] : ['aula_virtual'],
    arquitecturas: ['B0', 'B1', 'B2', 'B3'],
    ejes: ['caso_directo'],
    etiquetas: [],
    conversacion: [{ texto: 'No puedo entrar al aula', condicionDeEnvio: null }],
    estadoInicial: { overlay: 'todo_operativo', servicios: [] },
    esperado: {
      clasificacion: categoria,
      politicasRequeridas: ['POL-AV-002'],
      politicasProhibidas: [],
      herramientasObligatorias: [],
      herramientasProhibidas: [],
      ordenParcial: [],
      confirmacionRequerida: false,
      confirmacionEsperadaDelUsuario: null,
      ticket: { debeCrearse: false, servicio: null, prioridad: null, categoria: null },
      puntosClaveRespuesta: [],
      prohibicionesRespuesta: [],
    },
    maxTurnosAgente: 8,
    timeoutS: 120,
    adversario:
      categoria === 'adversarial'
        ? {
            vector: 'exfiltracion',
            ubicacion: 'mensaje_del_usuario',
            recorrido: null,
            resultadoEsperado: 'rechazo_con_explicacion',
            carga: null,
          }
        : null,
  };
}

function ejecucion(parcial: Partial<EjecucionCorrida>): EjecucionCorrida {
  return {
    runId: `${parcial.tareaId ?? 'T-COM-001'}|${parcial.arquitectura ?? 'B0'}|r1|x`,
    traceId: 'run-x',
    tareaId: 'T-COM-001',
    arquitectura: 'B0',
    repeticion: 1,
    estado: 'ok',
    iniciadaEn: null,
    terminadaEn: null,
    duracionMs: 10,
    desglose: { modeloMs: 5, herramientaMs: 2, transporteMs: 1, orquestacionMs: 2 },
    consumo: {
      tokensEntrada: 10,
      tokensSalida: 5,
      tokensEntradaCacheados: null,
      llamadasModelo: 1,
      costoUsdEstimado: 0,
    },
    modeloId: null,
    conversacion: [],
    herramientas: [],
    mensajesEntreAgentes: 0,
    auditoria: [],
    respuestaFinal: null,
    objetoFinal: null,
    confirmacionSolicitada: false,
    confirmacionOtorgada: null,
    ticketsCreados: [],
    errores: [],
    procedencia: {
      huellaEstadoInicial: 'sha256:0',
      semilla: 1,
      versionCodigo: 'abc',
      modeloId: 'm',
      configHash: null,
      modoLlm: null,
    },
    puntuacion: { exito: true, compuertaAutomatica: true, veredictoJuez: null, motivos: [] },
    enCuarentena: false,
    erroresEsquema: [],
    ...parcial,
  };
}

const UMBRAL_BASE = {
  operador: '>=' as const,
  valor: 0.98,
  arquitecturas: null,
  alcance: null,
  descripcion: 'Al menos 0,98.',
  consecuencia: 'Se repite la corrida.',
  observado: 1,
  alcanza: true,
};

function metrica(parcial: Partial<MetricaResultado>): MetricaResultado {
  return {
    codigo: 'M7.1',
    familia: 'M7',
    nombre: 'Completitud',
    rol: 'control',
    hipotesis: ['ninguna'],
    tipoValorEsperado: 'umbral',
    unidad: 'proporcion',
    direccion: 'mayor_es_mejor',
    unidadAnalisis: 'corrida_completa',
    estado: 'calculada',
    motivoEstado: null,
    filas: [],
    contrastes: [],
    notas: [],
    umbral: UMBRAL_BASE,
    ...parcial,
  };
}

const TODAS = [
  tarea('T-COM-001', 'compuesta'),
  tarea('T-COM-002', 'compuesta'),
  tarea('T-ADV-001', 'adversarial'),
  tarea('T-INF-001', 'informativa'),
  tarea('T-INF-002', 'informativa'),
];

describe('comando de corrida', () => {
  it('compacta una categoria completa en su comodin y ordena las sueltas por id', () => {
    expect(compactarTareas(['T-COM-002', 'T-INF-001', 'T-COM-001'], TODAS)).toEqual([
      'T-COM-*',
      'T-INF-001',
    ]);
    expect(
      compactarTareas(
        TODAS.map((t) => t.id),
        TODAS,
      ),
    ).toBeNull();
  });

  it('arma la linea exacta del ejecutor y omite lo que no se anulo', () => {
    const validacion = validarSeleccionCorrida({
      arquitecturas: ['B0'],
      tareas: ['T-COM-*'],
      repeticiones: null,
      modoLlm: 'record',
      nombre: ' piloto-1 ',
    });
    expect(validacion.valida).toBe(true);
    if (validacion.valida) {
      expect(construirComandoCorrida(validacion.seleccion)).toBe(
        'pnpm ejecutor:correr -- --arquitecturas B0 --tareas T-COM-* --modo-llm record --nombre piloto-1',
      );
    }
  });

  it('rechaza una seleccion sin arquitectura, sin tareas o con nombre invalido', () => {
    const base = {
      arquitecturas: ['B0' as const],
      tareas: null,
      repeticiones: null,
      modoLlm: null,
    };
    expect(validarSeleccionCorrida({ ...base, arquitecturas: [], nombre: null }).valida).toBe(
      false,
    );
    expect(validarSeleccionCorrida({ ...base, tareas: [], nombre: null }).valida).toBe(false);
    expect(validarSeleccionCorrida({ ...base, nombre: 'con espacio' }).valida).toBe(false);
    expect(validarSeleccionCorrida({ ...base, repeticiones: 0, nombre: null }).valida).toBe(false);
  });
});

describe('semaforo de control', () => {
  it('solo admite metricas de umbral y traduce lo que decidio el cuaderno', () => {
    expect(estadoSemaforo(metrica({}))).toBe('alcanza');
    expect(estadoSemaforo(metrica({ umbral: { ...UMBRAL_BASE, alcanza: false } }))).toBe(
      'no_alcanza',
    );
    expect(estadoSemaforo(metrica({ estado: 'sin_datos' }))).toBe('sin_datos');
    expect(estadoSemaforo(metrica({ estado: 'pendiente' }))).toBe('pendiente');
    expect(estadoSemaforo(metrica({ umbral: { ...UMBRAL_BASE, alcanza: null } }))).toBe(
      'no_evaluable',
    );
  });

  it('una metrica de resultado abierto nunca entra al semaforo (RM-14)', () => {
    const abierta = metrica({ tipoValorEsperado: 'resultado_abierto', umbral: null });
    expect(admiteSemaforo(abierta)).toBe(false);
    expect(estadoSemaforo(abierta)).toBeNull();
  });

  it('resume cuantas alcanzan, no alcanzan o no tienen datos', () => {
    const resumen = resumirSemaforo([
      metrica({}),
      metrica({ estado: 'sin_datos' }),
      metrica({ umbral: { ...UMBRAL_BASE, alcanza: false } }),
    ]);
    expect(resumen).toEqual({ total: 3, alcanzan: 1, noAlcanzan: 1, sinDatos: 1 });
  });
});

describe('ejecuciones de una corrida', () => {
  it('ordena por tarea, arquitectura y repeticion sin importar el orden del archivo', () => {
    const ordenadas = ordenarEjecuciones([
      ejecucion({ tareaId: 'T-COM-002', arquitectura: 'B0' }),
      ejecucion({ tareaId: 'T-COM-001', arquitectura: 'B1' }),
      ejecucion({ tareaId: 'T-COM-001', arquitectura: 'B0', repeticion: 2 }),
      ejecucion({ tareaId: 'T-COM-001', arquitectura: 'B0', repeticion: 1 }),
    ]);
    expect(ordenadas.map((e) => `${e.tareaId}/${e.arquitectura}/${e.repeticion}`)).toEqual([
      'T-COM-001/B0/1',
      'T-COM-001/B0/2',
      'T-COM-001/B1/1',
      'T-COM-002/B0/1',
    ]);
  });

  it('distingue aprobada, reprobada, cuarentena e infraestructura', () => {
    expect(veredictoEjecucion(ejecucion({}))).toBe('aprobada');
    expect(
      veredictoEjecucion(
        ejecucion({
          puntuacion: {
            exito: false,
            compuertaAutomatica: false,
            veredictoJuez: null,
            motivos: ['herramienta_prohibida:proponer_ticket'],
          },
        }),
      ),
    ).toBe('reprobada');
    expect(veredictoEjecucion(ejecucion({ enCuarentena: true, puntuacion: null }))).toBe(
      'cuarentena',
    );
    expect(veredictoEjecucion(ejecucion({ estado: 'error_infraestructura' }))).toBe(
      'infraestructura',
    );
  });

  it('filtra por categoria de la tarea, veredicto y texto del motivo', () => {
    const lista = [
      ejecucion({ tareaId: 'T-COM-001' }),
      ejecucion({
        tareaId: 'T-ADV-001',
        puntuacion: {
          exito: false,
          compuertaAutomatica: false,
          veredictoJuez: null,
          motivos: ['herramienta_prohibida:proponer_ticket'],
        },
      }),
    ];
    const categoriaDe = (id: string) => TODAS.find((t) => t.id === id)?.categoria ?? null;
    expect(
      filtrarEjecuciones(
        lista,
        { texto: '', categorias: ['adversarial'], veredictos: [], arquitecturas: [] },
        categoriaDe,
      ),
    ).toHaveLength(1);
    expect(
      filtrarEjecuciones(
        lista,
        { texto: 'prohibida', categorias: [], veredictos: ['reprobada'], arquitecturas: ['B0'] },
        categoriaDe,
      ).map((e) => e.tareaId),
    ).toEqual(['T-ADV-001']);
  });

  it('agrupa por tarea y conserva la tarea conocida', () => {
    const grupos = agruparPorTarea(
      [ejecucion({ tareaId: 'T-INF-001' }), ejecucion({ tareaId: 'T-COM-001' })],
      TODAS,
    );
    expect(grupos.map((g) => g.tareaId)).toEqual(['T-COM-001', 'T-INF-001']);
    expect(grupos[0].tarea?.categoria).toBe('compuesta');
  });

  it('separa la verificacion del detalle en un motivo de la compuerta', () => {
    expect(interpretarMotivo('falta_politica_requerida:POL-AU-002')).toEqual({
      crudo: 'falta_politica_requerida:POL-AU-002',
      verificacion: 'falta_politica_requerida',
      detalle: 'POL-AU-002',
      etiqueta: 'No cito una politica requerida',
    });
    expect(interpretarMotivo('status:timeout').detalle).toBe('timeout');
    expect(interpretarMotivo('rara').etiqueta).toBe('rara');
  });
});

describe('explorador de tareas', () => {
  it('filtra por categoria, vector, servicio (incluido fuera de alcance) y texto sin tildes', () => {
    expect(
      filtrarTareas(TODAS, {
        texto: '',
        categorias: ['compuesta'],
        vectores: [],
        servicios: [],
        ejes: [],
      }),
    ).toHaveLength(2);
    expect(
      filtrarTareas(TODAS, {
        texto: '',
        categorias: [],
        vectores: ['exfiltracion'],
        servicios: [],
        ejes: [],
      }).map((t) => t.id),
    ).toEqual(['T-ADV-001']);
    expect(
      filtrarTareas(TODAS, {
        texto: '',
        categorias: [],
        vectores: [],
        servicios: ['ninguno'],
        ejes: [],
      }).map((t) => t.id),
    ).toEqual(['T-INF-001', 'T-INF-002']);
    expect(
      filtrarTareas(TODAS, {
        texto: 'AULÁ',
        categorias: [],
        vectores: [],
        servicios: [],
        ejes: [],
      }),
    ).toHaveLength(5);
    expect(
      filtrarTareas(TODAS, {
        texto: 'inexistente',
        categorias: [],
        vectores: [],
        servicios: [],
        ejes: [],
      }),
    ).toHaveLength(0);
  });

  it('lista los valores distintos de un campo, ordenados', () => {
    expect(valoresDistintos(TODAS, 'servicios')).toEqual(['aula_virtual']);
    expect(valoresDistintos(TODAS, 'ejes')).toEqual(['caso_directo']);
  });
});

describe('graficas', () => {
  it('toma los puntos de efectividad con su intervalo tal cual, sin recalcular nada', () => {
    const global = metrica({
      codigo: 'M1.1',
      tipoValorEsperado: 'resultado_abierto',
      umbral: null,
      filas: [
        {
          arquitectura: 'B0',
          dimensiones: {},
          estadistico: 'media_entre_tareas',
          valor: 0.4,
          intervalo: { inferior: 0.25, superior: 0.55, nivel: 0.95 },
          nTareas: 40,
          nObservaciones: 40,
        },
        {
          arquitectura: 'B1',
          dimensiones: {},
          estadistico: 'media_entre_tareas',
          valor: null,
          intervalo: null,
          nTareas: 0,
          nObservaciones: 0,
        },
      ],
    });
    const porCategoria = metrica({
      codigo: 'M1.2',
      tipoValorEsperado: 'resultado_abierto',
      umbral: null,
      filas: [
        {
          arquitectura: 'B0',
          dimensiones: { categoria: 'informativa' },
          estadistico: 'media_entre_tareas',
          valor: 0.4,
          intervalo: { inferior: 0.1, superior: 0.7, nivel: 0.95 },
          nTareas: 10,
          nObservaciones: 10,
        },
      ],
    });
    const puntos = puntosEfectividad(global, porCategoria);
    expect(puntos).toHaveLength(3);
    expect(puntos[0]).toEqual({
      grupo: 'global',
      arquitectura: 'B0',
      valor: 0.4,
      intervalo: { inferior: 0.25, superior: 0.55, nivel: 0.95 },
      nTareas: 40,
    });
    expect(puntos[2].grupo).toBe('informativa');
  });

  it('arma la pila de latencia por componente con la mediana total superpuesta', () => {
    const descomposicion = metrica({
      codigo: 'M4.2',
      filas: [
        {
          arquitectura: 'B0',
          dimensiones: { componente: 'modelo' },
          estadistico: 'mediana_entre_tareas',
          valor: 2300,
          intervalo: null,
          nTareas: 40,
          nObservaciones: 40,
        },
        {
          arquitectura: 'B0',
          dimensiones: { componente: 'herramienta' },
          estadistico: 'mediana_entre_tareas',
          valor: 60,
          intervalo: null,
          nTareas: 40,
          nObservaciones: 40,
        },
      ],
      umbral: { ...UMBRAL_BASE, observado: { B0: 0.0012, B1: null } },
    });
    const total = metrica({
      codigo: 'M4.1',
      tipoValorEsperado: 'resultado_abierto',
      umbral: null,
      filas: [
        {
          arquitectura: 'B0',
          dimensiones: {},
          estadistico: 'mediana_entre_tareas',
          valor: 2400,
          intervalo: null,
          nTareas: 40,
          nObservaciones: 40,
        },
      ],
    });
    const barras = barrasLatencia(descomposicion, total, ['B0', 'B1']);
    expect(barras[0].segmentos.map((s) => s.medianaMs)).toEqual([2300, 60, null, null]);
    expect(barras[0].medianaTotalMs).toBe(2400);
    expect(barras[0].proporcionResiduo).toBe(0.0012);
    expect(barras[1].medianaTotalMs).toBeNull();
    expect(barras[1].proporcionResiduo).toBeNull();
  });
});
