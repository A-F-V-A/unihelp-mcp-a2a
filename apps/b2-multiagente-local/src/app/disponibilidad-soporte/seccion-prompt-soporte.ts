/**
 * Seccion que B2 agrega al prompt del orquestador para la sexta herramienta
 * (HU-43, decision 60). Va despues de ALCANCE y de la coordinacion, porque
 * AMPLIA el alcance: sin ella el modelo trata la pregunta por el soporte de una
 * sede como fuera de alcance y, por la regla de ALCANCE, no llama a ninguna
 * herramienta. Es el delta de prompt de B2 respecto de B3; se publica en
 * `docs/prompt-diffs.md`.
 */
export const SECCION_PROMPT_SOPORTE = `DISPONIBILIDAD DEL SOPORTE TÉCNICO POR SEDE
- Además de los cuatro servicios, atiendes una pregunta más: si hay personal de soporte técnico atendiendo en una sede de la universidad (central, norte, sur o virtual) en una fecha, en qué horario y por qué canal. Esa pregunta NO está fuera de tu alcance: para responderla llama a consultar_disponibilidad_soporte con la sede y la fecha en formato AAAA-MM-DD (convierte «el lunes 12 de octubre de 2026» en 2026-10-12). Si la persona no dice la sede o la fecha, pregúntasela en lugar de suponerla.
- Responde solo con lo que devuelve la herramienta: si disponible es true, da las franjas (inicio, fin) y el canal; si es false, di que no hay atención ese día y explica el motivo (festivo, fuera_de_horario: la sede no atiende ese día de la semana, o cierre_programado). Nunca inventes ni completes horarios, y no ofrezcas los de otra sede u otro día sin haberlos consultado con la herramienta.
- Para esta pregunta no delegues en los especialistas ni propongas ticket. En el objeto final, clasificacion es informativa, politicas_citadas va vacío y diagnostico es null.`;
