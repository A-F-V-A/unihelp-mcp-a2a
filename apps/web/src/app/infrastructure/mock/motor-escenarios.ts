import type {
  BloqueRespuestaDto,
  ClasificacionDto,
  CitaPoliticaDto,
  EstadoServicioDto,
} from '@unihelp/contratos';
import { CANALES_ATENCION } from './fixtures/canales.fixture';
import {
  ESCENARIOS,
  PLANTILLA_SEGUIMIENTO,
  TEXTO_SIN_COINCIDENCIA,
} from './fixtures/escenarios.fixture';
import { POLITICAS } from './fixtures/politicas.fixture';
import { TITULOS_POR_ESCENARIO } from './fixtures/titulos.fixture';
import { ESTADOS_SERVICIO } from './fixtures/servicios.fixture';
import type {
  BloqueEscenario,
  BorradorPropuesta,
  EscenarioConversacion,
  EstadoServicioFixture,
} from './fixtures/tipos';

/*
 * "Cerebro" del backend simulado: funciones puras que convierten un texto y
 * el contexto de la conversacion en una respuesta con forma de contrato. No
 * pretende clasificar bien (eso lo compara el experimento en B0-B3); solo
 * reproduce de forma determinista cada tipo de respuesta que la UI debe saber
 * mostrar.
 */

export interface RespuestaGenerada {
  /** `null` si la respuesta no debe cambiar el tema de la conversacion. */
  readonly escenarioId: string | null;
  readonly clasificacion: ClasificacionDto;
  readonly bloques: BloqueRespuestaDto[];
  readonly propuesta: BorradorPropuesta | null;
  /** Titulo para una conversacion que empieza con esta respuesta; `null` si no hay escenario. */
  readonly titulo: string | null;
}

export function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const escaparRegex = (valor: string) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function contarCoincidencias(textoNormalizado: string, escenario: EscenarioConversacion): number {
  return escenario.palabrasClave.filter((clave) =>
    new RegExp(`(^|[^a-z0-9])${escaparRegex(clave)}($|[^a-z0-9])`).test(textoNormalizado),
  ).length;
}

export function resolverEscenario(
  texto: string,
  escenarios: readonly EscenarioConversacion[] = ESCENARIOS,
): EscenarioConversacion | null {
  const normalizado = normalizarTexto(texto);
  let mejor: EscenarioConversacion | null = null;
  let mejorPuntaje = 0;

  for (const escenario of escenarios) {
    const puntaje = contarCoincidencias(normalizado, escenario);
    if (puntaje > mejorPuntaje) {
      mejor = escenario;
      mejorPuntaje = puntaje;
    }
  }

  return mejor;
}

const sumarMinutos = (fecha: Date, minutos: number) =>
  new Date(fecha.getTime() + minutos * 60_000).toISOString();

export function materializarEstadoServicio(
  fixture: EstadoServicioFixture,
  ahora: Date,
): EstadoServicioDto {
  const { ventanaRelativaMin, actualizadoHaceMin, ...resto } = fixture;
  return {
    ...resto,
    ventanaEstimada: ventanaRelativaMin
      ? {
          inicio: sumarMinutos(ahora, ventanaRelativaMin.inicio),
          fin: sumarMinutos(ahora, ventanaRelativaMin.fin),
        }
      : null,
    actualizadoEn: sumarMinutos(ahora, -actualizadoHaceMin),
  };
}

function citar(codigo: string): CitaPoliticaDto {
  const politica = POLITICAS.find((candidata) => candidata.codigo === codigo);
  if (!politica) {
    throw new Error(`Fixture inconsistente: no existe la politica ${codigo}.`);
  }
  const { codigo: c, version, titulo, extracto, area } = politica;
  return { codigo: c, version, titulo, extracto, area };
}

export function construirBloque(bloque: BloqueEscenario, ahora: Date): BloqueRespuestaDto {
  switch (bloque.tipo) {
    case 'texto':
      return { tipo: 'texto', texto: bloque.texto };
    case 'politicas':
      return { tipo: 'politicas', politicas: bloque.codigos.map(citar) };
    case 'estado-servicio':
      return {
        tipo: 'estado-servicio',
        estado: materializarEstadoServicio(ESTADOS_SERVICIO[bloque.servicio], ahora),
      };
    case 'aviso-mantenimiento':
      return {
        tipo: 'aviso-mantenimiento',
        estado: materializarEstadoServicio(ESTADOS_SERVICIO[bloque.servicio], ahora),
      };
    case 'fuera-de-alcance':
      return {
        tipo: 'fuera-de-alcance',
        motivo: bloque.motivo,
        canal: CANALES_ATENCION[bloque.canal],
      };
  }
}

/**
 * Genera la respuesta a un turno. Si el texto no activa ningun escenario pero la
 * conversacion ya tenia tema, responde como seguimiento de ese tema (HU-04).
 */
export function generarRespuesta(
  texto: string,
  ultimoEscenarioId: string | null,
  ahora: Date,
): RespuestaGenerada {
  const escenario = resolverEscenario(texto);

  if (escenario) {
    return {
      escenarioId: escenario.fijaContexto ? escenario.id : null,
      clasificacion: { ...escenario.clasificacion },
      bloques: escenario.bloques.map((bloque) => construirBloque(bloque, ahora)),
      propuesta: escenario.propuesta,
      titulo: TITULOS_POR_ESCENARIO[escenario.id] ?? null,
    };
  }

  const previo = ESCENARIOS.find((candidato) => candidato.id === ultimoEscenarioId);
  if (previo) {
    return {
      escenarioId: null,
      clasificacion: { tipo: previo.clasificacion.tipo, confianza: 0.7 },
      bloques: [{ tipo: 'texto', texto: PLANTILLA_SEGUIMIENTO.replace('{tema}', previo.tema) }],
      propuesta: null,
      titulo: null,
    };
  }

  return {
    escenarioId: null,
    clasificacion: { tipo: 'informativa', confianza: 0.41 },
    bloques: [{ tipo: 'texto', texto: TEXTO_SIN_COINCIDENCIA }],
    propuesta: null,
    titulo: null,
  };
}

const LONGITUD_TITULO = 42;

/** Titulo legible a partir del primer mensaje, cuando ningun escenario lo define. */
export function recortarTitulo(texto: string): string {
  const limpio = texto
    .replace(/#[\w-]+/g, '')
    .replace(/[¿?¡!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const titulo = limpio.charAt(0).toUpperCase() + limpio.slice(1);
  if (!titulo) {
    return 'Nueva conversación';
  }
  if (titulo.length <= LONGITUD_TITULO) {
    return titulo;
  }
  const corte = titulo.slice(0, LONGITUD_TITULO);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${(ultimoEspacio > 20 ? corte.slice(0, ultimoEspacio) : corte).trimEnd()}…`;
}
