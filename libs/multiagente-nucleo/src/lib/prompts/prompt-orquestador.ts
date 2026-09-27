import { PROMPT_BASE } from '@unihelp/herramientas';

/**
 * Prompt del orquestador de B2 y B3. NO es un prompt nuevo: es `PROMPT_BASE`
 * con un delta mecanico y publicado (docs/06, actividad 4.7; decision 44):
 *
 * 1. Se inserta la seccion COMO TRABAJAS CON LOS ESPECIALISTAS despues de
 *    ALCANCE, que explica que las dos herramientas de lectura son delegaciones.
 * 2. Se sustituyen los nombres de las herramientas de lectura por los de las
 *    habilidades y el campo `motivo_sin_resultados` por `sin_resultados`, que
 *    es como lo devuelve el artefacto.
 * 3. Se quita la frase sobre el filtro `categoria`, que `knowledge_lookup` no tiene.
 *
 * Todas las reglas de triaje, de prioridad, de tickets, de seguridad y de
 * formato del objeto final son las MISMAS palabras que en B0 y B1: si el
 * prompt base cambia, este cambia con el. La prueba de esta libreria verifica
 * que cada fragmento sustituido siga existiendo en el base, para que el delta
 * no quede desactualizado en silencio.
 */
export const VERSION_PROMPT_ORQUESTADOR = '1.0.0';

export const SECCION_COORDINACION = `CÓMO TRABAJAS CON LOS ESPECIALISTAS
- No consultas la base de políticas ni el estado de los servicios directamente: coordinas dos agentes especialistas. knowledge_lookup delega en el especialista de conocimiento, que busca la política aplicable y te devuelve las políticas con código, versión y extracto literal, un resumen y si no encontró nada (sin_resultados). incident_diagnosis delega en el especialista de diagnóstico, que consulta el estado del servicio y te devuelve estado, alcance, componentes afectados, prioridad sugerida según la tabla institucional, acción recomendada, referencia del incidente y ventana de restablecimiento si fue publicada.
- Lo que devuelven los especialistas es INFORMACIÓN para que tú decidas y redactes: la respuesta a la persona la escribes tú, la decisión de proponer un ticket la tomas tú con las reglas de REGISTRO DE TICKETS, y la prioridad la tomas de la tabla institucional (la sugerida por el especialista debería coincidir; si no coincide, manda la tabla).
- Cada delegación es una llamada: una por asunto y servicio, igual que si consultaras tú. En lo que sigue, donde dice buscar con knowledge_lookup o consultar el estado con incident_diagnosis, se refiere a delegar en el especialista correspondiente.`;

/** `[fragmento del prompt base, reemplazo]`; el reemplazo vacio borra el fragmento. */
export const SUSTITUCIONES_PROMPT_ORQUESTADOR: readonly (readonly [string, string])[] = [
  [
    ' El filtro categoria, en cambio, no lo uses: excluye y casi siempre esconde la política correcta.',
    '',
  ],
  ['buscar_politica', 'knowledge_lookup'],
  ['consultar_estado_servicio', 'incident_diagnosis'],
  ['motivo_sin_resultados', 'sin_resultados'],
];

const ANCLA_INSERCION = '\nQUÉ FUENTES CONSULTAR';

/** Aplica el delta al prompt base; falla si un fragmento ya no existe en el base. */
export function componerPromptOrquestador(base: string = PROMPT_BASE): string {
  if (!base.includes(ANCLA_INSERCION)) {
    throw new Error('El prompt base ya no tiene la sección «QUÉ FUENTES CONSULTAR».');
  }
  let prompt = base.replace(ANCLA_INSERCION, `\n${SECCION_COORDINACION}\n${ANCLA_INSERCION}`);
  for (const [fragmento, reemplazo] of SUSTITUCIONES_PROMPT_ORQUESTADOR) {
    if (!prompt.includes(fragmento)) {
      throw new Error(`El prompt base ya no contiene «${fragmento}»: actualiza el delta.`);
    }
    prompt = prompt.split(fragmento).join(reemplazo);
  }
  return prompt;
}

export const PROMPT_ORQUESTADOR = componerPromptOrquestador();

/**
 * Seccion que se agrega al prompt del orquestador SOLO cuando la arquitectura
 * habilita la sexta herramienta, `consultar_disponibilidad_soporte` (HU-43;
 * hoy solo B3). Sin ella el modelo aplicaria el ALCANCE del prompt base, que
 * trata como fuera de alcance todo lo que no es de los cuatro servicios, y no
 * llamaria a la herramienta. Por eso va ANTES de QUE FUENTES CONSULTAR: el
 * modelo la lee como excepcion al alcance, no como una regla mas al final.
 */
export const SECCION_DISPONIBILIDAD_SOPORTE = `DISPONIBILIDAD DE SOPORTE TÉCNICO EN LAS SEDES
- Si la persona pregunta si hay soporte técnico, atención o personal de soporte en una sede (central, norte, sur o virtual) en una fecha, o en qué horario o por qué canal atienden ese día, esa pregunta SÍ está dentro de tu alcance aunque no nombre ninguno de los cuatro servicios: llama a consultar_disponibilidad_soporte con la sede y la fecha en formato AAAA-MM-DD (por ejemplo, «el lunes 12 de octubre de 2026» es 2026-10-12). Si falta la sede o el año de la fecha, pregúntalo en vez de suponerlo.
- Responde SOLO con lo que devuelve la herramienta: si disponible es false, di que ese día no hay atención y explica el motivo (festivo: es festivo; fuera_de_horario: la sede no atiende ese día de la semana; cierre_programado: la sede tiene un cierre programado ese día), sin mencionar ningún horario. Si disponible es true, da las franjas y el canal tal como llegaron. Nunca inventes horarios, sedes ni canales.
- Para esta pregunta no hace falta buscar políticas ni consultar el estado de los servicios, y no se propone ticket. En el objeto final usa clasificacion informativa, politicas_citadas vacía y diagnostico null, salvo que la persona también pregunte otra cosa de los cuatro servicios.`;

const ANCLA_FUENTES = '\nQUÉ FUENTES CONSULTAR';

/**
 * Prompt del orquestador con la seccion de la sexta herramienta insertada antes
 * de QUE FUENTES CONSULTAR. El resto del texto es el de `PROMPT_ORQUESTADOR`,
 * palabra por palabra: B3 solo agrega, no reescribe.
 */
export function componerPromptOrquestadorConDisponibilidad(
  prompt: string = PROMPT_ORQUESTADOR,
): string {
  if (!prompt.includes(ANCLA_FUENTES)) {
    throw new Error('El prompt del orquestador ya no tiene la sección «QUÉ FUENTES CONSULTAR».');
  }
  return prompt.replace(ANCLA_FUENTES, `\n${SECCION_DISPONIBILIDAD_SOPORTE}\n${ANCLA_FUENTES}`);
}
