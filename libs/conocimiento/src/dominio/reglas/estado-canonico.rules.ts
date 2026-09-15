/**
 * Serializacion canonica del estado de la base de conocimiento: la entrada de
 * la huella (HU-36). Dos estados con las mismas filas producen exactamente el
 * mismo texto, sin importar el orden en que se insertaron o se leyeron.
 */
import type { ConteosConocimiento, EstadoConocimiento, TablaConocimiento } from '../grafo';

/** Version del formato. Si cambia la serializacion, cambia este valor y con el todas las huellas. */
export const FORMATO_ESTADO_CANONICO = 'unihelp/conocimiento/estado-canonico/v2';

type Clave = readonly (string | number)[];

/**
 * Orden por punto de codigo Unicode: el mismo de `COLLATE "C"` en PostgreSQL
 * sobre UTF-8. Nunca `localeCompare`, cuyo resultado depende del idioma
 * configurado en la maquina (decision 17).
 */
export function compararTexto(a: string, b: string): number {
  const puntosA = [...a];
  const puntosB = [...b];
  const largo = Math.min(puntosA.length, puntosB.length);
  for (let i = 0; i < largo; i++) {
    const diferencia = (puntosA[i]?.codePointAt(0) ?? 0) - (puntosB[i]?.codePointAt(0) ?? 0);
    if (diferencia !== 0) {
      return diferencia;
    }
  }
  return puntosA.length - puntosB.length;
}

function compararClaves(a: Clave, b: Clave): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    const diferencia =
      typeof x === 'number' && typeof y === 'number' ? x - y : compararTexto(String(x), String(y));
    if (diferencia !== 0) {
      return diferencia;
    }
  }
  return a.length - b.length;
}

function ordenar<T>(filas: readonly T[], clave: (fila: T) => Clave): readonly T[] {
  return [...filas].sort((a, b) => compararClaves(clave(a), clave(b)));
}

/**
 * Cada tabla se ordena por su clave primaria y cada fila se escribe como una
 * tupla con columnas en orden fijo: `JSON.stringify` sobre arreglos de texto,
 * enteros, booleanos y `null` no tiene ambiguedad.
 */
export function serializarEstadoCanonico(estado: EstadoConocimiento): string {
  const tablas: readonly (readonly [TablaConocimiento, readonly (readonly unknown[])[]])[] = [
    [
      'servicios',
      ordenar(estado.servicios, (s) => [s.codigo]).map((s) => [
        s.codigo,
        s.nombre,
        s.descripcion,
        s.unidadResponsable,
        s.area,
        s.nivelServicio,
      ]),
    ],
    [
      'estados_servicio',
      ordenar(estado.estadosServicio, (e) => [e.servicioCodigo]).map((e) => [
        e.servicioCodigo,
        e.estado,
        e.alcance,
        e.mensaje,
        e.ventanaEstimada?.inicio ?? null,
        e.ventanaEstimada?.fin ?? null,
        e.incidenteRef,
        e.desde,
      ]),
    ],
    [
      'componentes',
      ordenar(estado.componentes, (c) => [c.codigo]).map((c) => [
        c.codigo,
        c.nombre,
        c.estado,
        c.ventanaEstimada?.inicio ?? null,
        c.ventanaEstimada?.fin ?? null,
        c.incidenteRef,
        c.actualizadoEn,
      ]),
    ],
    [
      'categorias',
      ordenar(estado.categorias, (c) => [c.codigo]).map((c) => [c.codigo, c.nombre, c.descripcion]),
    ],
    [
      'politicas',
      ordenar(estado.politicas, (p) => [p.codigo]).map((p) => [
        p.codigo,
        p.alcance,
        p.dependenciaResponsable,
        p.enlace,
        p.adversarial,
        p.origen,
      ]),
    ],
    [
      'versiones_politica',
      ordenar(estado.versiones, (v) => [v.politicaCodigo, v.version]).map((v) => [
        v.politicaCodigo,
        v.version,
        v.titulo,
        v.vigenteDesde,
        v.vigente,
        v.contenido,
      ]),
    ],
    [
      'extractos',
      ordenar(estado.extractos, (e) => [e.politicaCodigo, e.version, e.ordinal]).map((e) => [
        e.politicaCodigo,
        e.version,
        e.ordinal,
        e.inicio,
        e.fin,
        e.texto,
      ]),
    ],
    [
      'servicio_componente',
      ordenar(estado.serviciosComponentes, (a) => [a.servicioCodigo, a.componenteCodigo]).map(
        (a) => [a.servicioCodigo, a.componenteCodigo],
      ),
    ],
    [
      'politica_categoria',
      ordenar(estado.politicasCategorias, (a) => [a.politicaCodigo, a.categoriaCodigo]).map((a) => [
        a.politicaCodigo,
        a.categoriaCodigo,
      ]),
    ],
    [
      'politica_servicio',
      ordenar(estado.politicasServicios, (a) => [a.politicaCodigo, a.servicioCodigo]).map((a) => [
        a.politicaCodigo,
        a.servicioCodigo,
      ]),
    ],
    [
      'entorno',
      [[estado.entorno.versionSemilla, estado.entorno.estadoInicial, estado.entorno.corpus]],
    ],
  ];
  return JSON.stringify([FORMATO_ESTADO_CANONICO, tablas]);
}

export function contarFilas(estado: EstadoConocimiento): ConteosConocimiento {
  return {
    servicios: estado.servicios.length,
    estados_servicio: estado.estadosServicio.length,
    componentes: estado.componentes.length,
    categorias: estado.categorias.length,
    politicas: estado.politicas.length,
    versiones_politica: estado.versiones.length,
    extractos: estado.extractos.length,
    servicio_componente: estado.serviciosComponentes.length,
    politica_categoria: estado.politicasCategorias.length,
    politica_servicio: estado.politicasServicios.length,
    entorno: 1,
  };
}
