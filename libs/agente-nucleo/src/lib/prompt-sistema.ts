/**
 * Token del prompt de sistema con el que empieza cada conversacion. Por defecto
 * es `PROMPT_BASE` (B0 y B1). El orquestador de B2 y B3 aporta el suyo, que se
 * compone a partir del base con un delta publicado (`docs/prompt-diffs.md`,
 * decision 44): el nucleo no sabe cual de los dos esta usando.
 */
export const PROMPT_SISTEMA = Symbol('PROMPT_SISTEMA');
