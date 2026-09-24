/*
 * Ayudas para las pruebas del servidor MCP: un registro con las cinco
 * herramientas del contrato implementadas por capacidades FALSAS (sin
 * PostgreSQL) y la herramienta que solo existe en el entorno de pruebas.
 * Ningun archivo de produccion importa esto.
 */
import {
  type Capacidad,
  CapacidadesLocales,
  InvocadorCapacidades,
  RegistroCapacidades,
} from '@unihelp/capacidades';
import type {
  BuscarPoliticaCapacidad,
  ConfirmarPropuestaCapacidad,
  ConsultarEstadoServicioCapacidad,
  CrearTicketSimuladoCapacidad,
  ProponerTicketCapacidad,
} from '@unihelp/capacidades';
import {
  type ContextoInvocacion,
  type DefinicionHerramienta,
  EjecutorCapacidad,
  ErrorHerramienta,
  NOMBRES_HERRAMIENTAS,
  type SalidaCapacidad,
  ValidadorArgumentos,
} from '@unihelp/herramientas';

/** Salidas validas segun `esquemaSalida`, para que el cliente MCP las acepte. */
export const SALIDAS_DE_PRUEBA: Readonly<Record<string, SalidaCapacidad>> = {
  buscar_politica: {
    paraModelo: {
      resultados: [],
      total_encontrados: 0,
      consulta_normalizada: 'prorroga',
      motivo_sin_resultados: 'sin-coincidencias',
    },
    estructurado: { tipo: 'sin-resultados', motivo: 'sin-coincidencias' },
  },
  consultar_estado_servicio: {
    paraModelo: {
      servicio: 'aula_virtual',
      nombre: 'Aula virtual',
      estado: 'DEGRADADO',
      desde: '2026-09-23T08:00:00.000Z',
      componentes_afectados: ['carga_de_archivos'],
      alcance: 'parcial',
      nivel_sla: 'alto',
      mensaje: null,
      eta_restablecimiento: null,
      ventana_estimada: null,
      incidente_ref: 'INC-2026-0042',
    },
    estructurado: { servicio: { codigo: 'aula_virtual' }, desde: new Date('2026-09-23T08:00:00Z') },
  },
  proponer_ticket: {
    paraModelo: {
      proposal_id: '3f2c9a4e-1b7d-4c8e-9f0a-2b3c4d5e6f70',
      resumen_legible: 'Servicio: aula_virtual',
      campos_faltantes: [],
      expira_en: '2026-09-23T10:15:00.000Z',
      listo_para_confirmar: true,
    },
    estructurado: { id: '3f2c9a4e-1b7d-4c8e-9f0a-2b3c4d5e6f70' },
  },
  confirmar_propuesta: {
    paraModelo: {
      confirmacion_token: 'token-de-prueba-largo-000',
      aceptada: true,
      motivo_rechazo: null,
    },
    estructurado: { aceptada: true },
  },
  crear_ticket_simulado: {
    paraModelo: {
      ticket_id: 'UH-2026-000001',
      estado: 'recibido',
      creado_en: '2026-09-23T10:05:00.000Z',
      creado: true,
      motivo: null,
    },
    estructurado: { ticket: { numero: 'UH-2026-000001' } },
  },
};

export interface RegistroDePrueba {
  readonly registro: RegistroCapacidades;
  readonly invocador: InvocadorCapacidades;
  readonly puertoLocal: CapacidadesLocales;
  /** Contextos con los que se invoco cada capacidad, en orden. */
  readonly contextos: ContextoInvocacion[];
  /** Hace que la capacidad falle con ese codigo en la siguiente llamada. */
  fallarCon(nombre: string, error: ErrorHerramienta | null): void;
}

export function capacidadDePrueba(
  nombre: string,
  salida: SalidaCapacidad,
  contextos: ContextoInvocacion[],
  fallos: Map<string, ErrorHerramienta>,
): Capacidad {
  return {
    nombre,
    ejecutar: async (_argumentos, contexto) => {
      contextos.push(contexto);
      const fallo = fallos.get(nombre);
      if (fallo) {
        throw fallo;
      }
      return salida;
    },
  };
}

export function montarRegistroDePrueba(): RegistroDePrueba {
  const contextos: ContextoInvocacion[] = [];
  const fallos = new Map<string, ErrorHerramienta>();
  const validador = new ValidadorArgumentos();
  const [buscar, estado, proponer, confirmar, crear] = NOMBRES_HERRAMIENTAS.map((n) =>
    capacidadDePrueba(n, SALIDAS_DE_PRUEBA[n] as SalidaCapacidad, contextos, fallos),
  );
  const registro = new RegistroCapacidades(
    buscar as BuscarPoliticaCapacidad,
    estado as ConsultarEstadoServicioCapacidad,
    proponer as ProponerTicketCapacidad,
    confirmar as ConfirmarPropuestaCapacidad,
    crear as CrearTicketSimuladoCapacidad,
    validador,
  );
  const auditoria = { registrar: async () => undefined };
  const invocador = new InvocadorCapacidades(
    registro,
    new EjecutorCapacidad(validador, auditoria, 20),
  );
  return {
    registro,
    invocador,
    puertoLocal: new CapacidadesLocales(registro, invocador),
    contextos,
    fallarCon: (nombre, error) => {
      if (error === null) {
        fallos.delete(nombre);
      } else {
        fallos.set(nombre, error);
      }
    },
  };
}

/** Herramienta que solo existe en las pruebas: la sexta real esta sellada hasta la semana 8. */
export const HERRAMIENTA_DE_PRUEBA: DefinicionHerramienta = {
  nombre: 'herramienta_de_prueba' as DefinicionHerramienta['nombre'],
  titulo: 'Herramienta de prueba',
  descripcion: 'Existe solo para probar el registro aditivo y la notificacion de cambio (HU-27).',
  esquemaEntrada: {
    type: 'object',
    properties: { texto: { type: 'string', minLength: 1 } },
    required: ['texto'],
    additionalProperties: false,
  },
  esquemaSalida: {
    type: 'object',
    properties: { eco: { type: 'string' } },
    required: ['eco'],
  },
  anotaciones: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  tipo: 'lectura',
};

export function capacidadDePruebaEco(): Capacidad {
  return {
    nombre: HERRAMIENTA_DE_PRUEBA.nombre,
    ejecutar: async (argumentos) => ({
      paraModelo: { eco: String(argumentos['texto']) },
      estructurado: { eco: String(argumentos['texto']) },
    }),
  };
}
