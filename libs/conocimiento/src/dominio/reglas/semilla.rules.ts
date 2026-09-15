/**
 * Validacion y expansion de los datos semilla. La semilla llega como `unknown`
 * (un JSON) y solo sale de aqui si respeta su forma, sus referencias y las
 * reglas de anonimizacion. Todo es sincrono y puro: la misma semilla y la misma
 * seleccion producen siempre el mismo `EstadoConocimiento`.
 */
import { AREAS_SERVICIO, NIVELES_ESTADO_SERVICIO } from '@unihelp/dominio';
import type { Categoria } from '../categoria';
import type { Componente, VentanaEstimada } from '../componente';
import { SeleccionEstadoInvalidaError, SemillaInvalidaError } from '../errores';
import { ALCANCES_AFECTACION } from '../estado-servicio';
import type { EstadoServicio } from '../estado-servicio';
import { CORPUS_CONOCIMIENTO, ESTADO_INICIAL_BASE } from '../grafo';
import type { EstadoConocimiento } from '../grafo';
import { ORIGENES_POLITICA } from '../politica';
import type { Extracto, VersionPolitica } from '../politica';
import { NIVELES_SERVICIO } from '../servicio';
import type {
  SeleccionEstado,
  SemillaAfectacion,
  SemillaComponente,
  SemillaConocimiento,
  SemillaEstadoInicial,
  SemillaPolitica,
  SemillaServicio,
  SemillaVersionPolitica,
} from '../semilla';

/** Separador entre extractos dentro de `VersionPolitica.contenido`. Un extracto no puede contenerlo. */
export const SEPARADOR_EXTRACTOS = '\n';

const PATRON_CODIGO_NODO = /^[a-z][a-z0-9_]*$/;
const PATRON_CODIGO_POLITICA = /^POL-[A-Z]{2}-\d{3}$/;
const PATRON_VERSION = /^\d+\.\d+$/;
const PATRON_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PATRON_REFERENCIA = /^(INC|MNT)-\d{4}-\d{4}$/;

/** Dominios reservados para documentacion y pruebas (RFC 2606, RFC 6761): nunca apuntan a una institucion real. */
const TLD_RESERVADOS = ['example', 'test', 'invalid', 'localhost'];
const DOMINIOS_RESERVADOS = ['example.com', 'example.net', 'example.org'];

const ESTADOS_AFECTADOS = NIVELES_ESTADO_SERVICIO.filter(
  (e): e is SemillaAfectacion['estado'] => e !== 'operativo',
);

type Objeto = Readonly<Record<string, unknown>>;

function fallar(ruta: string, detalle: string): never {
  throw new SemillaInvalidaError(ruta, detalle);
}

function comoObjeto(valor: unknown, ruta: string, claves: readonly string[]): Objeto {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    fallar(ruta, 'debe ser un objeto');
  }
  const objeto = valor as Objeto;
  // Claves exactas: una clave mal escrita se detecta en vez de ignorarse.
  for (const clave of claves) {
    if (!(clave in objeto)) {
      fallar(ruta, `falta la clave «${clave}»`);
    }
  }
  for (const clave of Object.keys(objeto)) {
    if (!claves.includes(clave)) {
      fallar(ruta, `clave desconocida «${clave}»`);
    }
  }
  return objeto;
}

function comoLista(valor: unknown, ruta: string, minimo: number): readonly unknown[] {
  if (!Array.isArray(valor)) {
    fallar(ruta, 'debe ser una lista');
  }
  if (valor.length < minimo) {
    fallar(ruta, `debe tener al menos ${minimo} elemento(s)`);
  }
  return valor;
}

function verificarTexto(valor: unknown, ruta: string): string {
  if (typeof valor !== 'string') {
    fallar(ruta, 'debe ser texto');
  }
  if (valor.length === 0 || valor.trim() !== valor) {
    fallar(ruta, 'no puede estar vacio ni tener espacios en los extremos');
  }
  if (valor.normalize('NFC') !== valor) {
    fallar(ruta, 'debe estar en forma Unicode NFC');
  }
  verificarDominiosReservados(valor, ruta);
  return valor;
}

function verificarDominiosReservados(valor: string, ruta: string): void {
  const hosts = [
    ...[...valor.matchAll(/https?:\/\/([^/\s:?#]+)/giu)].map((m) => m[1]),
    ...[...valor.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/gu)].map((m) => m[1]),
  ];
  for (const host of hosts) {
    const nombre = (host ?? '').toLowerCase();
    const tld = nombre.split('.').pop() ?? '';
    const reservado =
      TLD_RESERVADOS.includes(tld) ||
      DOMINIOS_RESERVADOS.some((d) => nombre === d || nombre.endsWith(`.${d}`));
    if (!reservado) {
      fallar(
        ruta,
        `usa el dominio no reservado «${nombre}»; solo se admiten dominios reservados (RFC 2606)`,
      );
    }
  }
}

function texto(objeto: Objeto, clave: string, ruta: string): string {
  return verificarTexto(objeto[clave], `${ruta}.${clave}`);
}

function textoONulo(objeto: Objeto, clave: string, ruta: string): string | null {
  return objeto[clave] === null ? null : texto(objeto, clave, ruta);
}

function codigo(objeto: Objeto, clave: string, ruta: string, patron: RegExp): string {
  const valor = texto(objeto, clave, ruta);
  if (!patron.test(valor)) {
    fallar(`${ruta}.${clave}`, `«${valor}» no cumple el patron ${patron.source}`);
  }
  return valor;
}

function valorPermitido<T extends string>(
  objeto: Objeto,
  clave: string,
  ruta: string,
  permitidos: readonly T[],
): T {
  const valor = texto(objeto, clave, ruta);
  const encontrado = permitidos.find((p) => p === valor);
  if (encontrado === undefined) {
    fallar(`${ruta}.${clave}`, `«${valor}» no es uno de: ${permitidos.join(', ')}`);
  }
  return encontrado;
}

function booleano(objeto: Objeto, clave: string, ruta: string): boolean {
  const valor = objeto[clave];
  if (typeof valor !== 'boolean') {
    fallar(`${ruta}.${clave}`, 'debe ser true o false');
  }
  return valor;
}

function instante(objeto: Objeto, clave: string, ruta: string): string {
  const valor = texto(objeto, clave, ruta);
  const valido =
    PATRON_INSTANTE.test(valor) &&
    !Number.isNaN(Date.parse(valor)) &&
    new Date(valor).toISOString() === valor.replace('Z', '.000Z');
  if (!valido) {
    fallar(
      `${ruta}.${clave}`,
      'debe ser un instante UTC con precision de segundos: AAAA-MM-DDTHH:MM:SSZ',
    );
  }
  return valor;
}

function fecha(objeto: Objeto, clave: string, ruta: string): string {
  const valor = texto(objeto, clave, ruta);
  const valida =
    PATRON_FECHA.test(valor) &&
    !Number.isNaN(Date.parse(`${valor}T00:00:00Z`)) &&
    new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
  if (!valida) {
    fallar(`${ruta}.${clave}`, 'debe ser una fecha AAAA-MM-DD');
  }
  return valor;
}

function ventanaONula(objeto: Objeto, clave: string, ruta: string): VentanaEstimada | null {
  if (objeto[clave] === null) {
    return null;
  }
  const rutaVentana = `${ruta}.${clave}`;
  const v = comoObjeto(objeto[clave], rutaVentana, ['inicio', 'fin']);
  const ventana = {
    inicio: instante(v, 'inicio', rutaVentana),
    fin: instante(v, 'fin', rutaVentana),
  };
  // Mismo formato de ancho fijo: la comparacion de texto es cronologica.
  if (ventana.fin <= ventana.inicio) {
    fallar(rutaVentana, 'fin debe ser posterior a inicio');
  }
  return ventana;
}

function listaDeCodigos(
  objeto: Objeto,
  clave: string,
  ruta: string,
  minimo: number,
): readonly string[] {
  const lista = comoLista(objeto[clave], `${ruta}.${clave}`, minimo).map((v, i) =>
    verificarTexto(v, `${ruta}.${clave}[${i}]`),
  );
  verificarUnicos(lista, `${ruta}.${clave}`);
  return lista;
}

function verificarUnicos(valores: readonly string[], ruta: string): void {
  const vistos = new Set<string>();
  for (const valor of valores) {
    if (vistos.has(valor)) {
      fallar(ruta, `«${valor}» esta repetido`);
    }
    vistos.add(valor);
  }
}

function verificarReferencias(
  referencias: readonly string[],
  existentes: ReadonlySet<string>,
  ruta: string,
  tipo: string,
): void {
  for (const referencia of referencias) {
    if (!existentes.has(referencia)) {
      fallar(ruta, `referencia a ${tipo} inexistente «${referencia}»`);
    }
  }
}

function validarServicio(valor: unknown, ruta: string): SemillaServicio {
  const o = comoObjeto(valor, ruta, [
    'codigo',
    'nombre',
    'descripcion',
    'unidadResponsable',
    'area',
    'nivelServicio',
    'componentes',
  ]);
  return {
    codigo: codigo(o, 'codigo', ruta, PATRON_CODIGO_NODO),
    nombre: texto(o, 'nombre', ruta),
    descripcion: texto(o, 'descripcion', ruta),
    unidadResponsable: texto(o, 'unidadResponsable', ruta),
    area: valorPermitido(o, 'area', ruta, AREAS_SERVICIO),
    nivelServicio: valorPermitido(o, 'nivelServicio', ruta, NIVELES_SERVICIO),
    componentes: listaDeCodigos(o, 'componentes', ruta, 1),
  };
}

function validarComponente(valor: unknown, ruta: string): SemillaComponente {
  const o = comoObjeto(valor, ruta, ['codigo', 'nombre']);
  return {
    codigo: codigo(o, 'codigo', ruta, PATRON_CODIGO_NODO),
    nombre: texto(o, 'nombre', ruta),
  };
}

function validarAfectacion(valor: unknown, ruta: string): SemillaAfectacion {
  const o = comoObjeto(valor, ruta, [
    'servicio',
    'estado',
    'alcance',
    'componentesAfectados',
    'mensaje',
    'ventanaEstimada',
    'incidenteRef',
    'desde',
  ]);
  const estado = valorPermitido(o, 'estado', ruta, ESTADOS_AFECTADOS);
  const alcance = valorPermitido(o, 'alcance', ruta, ALCANCES_AFECTACION);
  const ventanaEstimada = ventanaONula(o, 'ventanaEstimada', ruta);
  if ((estado === 'mantenimiento') !== (alcance === 'programado')) {
    fallar(ruta, 'el alcance «programado» corresponde solo y siempre a un mantenimiento');
  }
  // Un mantenimiento programado publica su ventana: T-DIA-007 y T-DIA-008 la informan.
  if (estado === 'mantenimiento' && ventanaEstimada === null) {
    fallar(ruta, 'un mantenimiento programado debe publicar su ventana');
  }
  return {
    servicio: texto(o, 'servicio', ruta),
    estado,
    alcance,
    componentesAfectados: listaDeCodigos(o, 'componentesAfectados', ruta, 1),
    mensaje: texto(o, 'mensaje', ruta),
    ventanaEstimada,
    incidenteRef: codigo(o, 'incidenteRef', ruta, PATRON_REFERENCIA),
    desde: instante(o, 'desde', ruta),
  };
}

function validarEstadoInicial(valor: unknown, ruta: string): SemillaEstadoInicial {
  const o = comoObjeto(valor, ruta, ['codigo', 'descripcion', 'afectaciones']);
  const afectaciones = comoLista(o['afectaciones'], `${ruta}.afectaciones`, 0).map((v, i) =>
    validarAfectacion(v, `${ruta}.afectaciones[${i}]`),
  );
  verificarUnicos(
    afectaciones.map((a) => a.servicio),
    `${ruta}.afectaciones`,
  );
  return {
    codigo: codigo(o, 'codigo', ruta, PATRON_CODIGO_NODO),
    descripcion: texto(o, 'descripcion', ruta),
    afectaciones,
  };
}

function validarCategoria(valor: unknown, ruta: string): Categoria {
  const o = comoObjeto(valor, ruta, ['codigo', 'nombre', 'descripcion']);
  return {
    codigo: codigo(o, 'codigo', ruta, PATRON_CODIGO_NODO),
    nombre: texto(o, 'nombre', ruta),
    descripcion: texto(o, 'descripcion', ruta),
  };
}

function validarVersion(valor: unknown, ruta: string): SemillaVersionPolitica {
  const o = comoObjeto(valor, ruta, ['version', 'titulo', 'vigenteDesde', 'vigente', 'extractos']);
  const extractos = comoLista(o['extractos'], `${ruta}.extractos`, 1).map((v, i) => {
    const rutaExtracto = `${ruta}.extractos[${i}]`;
    const extracto = verificarTexto(v, rutaExtracto);
    if (extracto.includes(SEPARADOR_EXTRACTOS)) {
      fallar(rutaExtracto, 'un extracto no puede contener saltos de linea');
    }
    return extracto;
  });
  return {
    version: codigo(o, 'version', ruta, PATRON_VERSION),
    titulo: texto(o, 'titulo', ruta),
    vigenteDesde: fecha(o, 'vigenteDesde', ruta),
    vigente: booleano(o, 'vigente', ruta),
    extractos,
  };
}

function validarPolitica(valor: unknown, ruta: string): SemillaPolitica {
  const o = comoObjeto(valor, ruta, [
    'codigo',
    'alcance',
    'dependenciaResponsable',
    'enlace',
    'adversarial',
    'origen',
    'categorias',
    'servicios',
    'versiones',
  ]);
  const versiones = comoLista(o['versiones'], `${ruta}.versiones`, 1).map((v, i) =>
    validarVersion(v, `${ruta}.versiones[${i}]`),
  );
  verificarUnicos(
    versiones.map((v) => v.version),
    `${ruta}.versiones`,
  );
  if (versiones.filter((v) => v.vigente).length !== 1) {
    fallar(`${ruta}.versiones`, 'debe haber exactamente una version vigente');
  }
  return {
    codigo: codigo(o, 'codigo', ruta, PATRON_CODIGO_POLITICA),
    alcance: texto(o, 'alcance', ruta),
    dependenciaResponsable: texto(o, 'dependenciaResponsable', ruta),
    enlace: textoONulo(o, 'enlace', ruta),
    adversarial: booleano(o, 'adversarial', ruta),
    origen: valorPermitido(o, 'origen', ruta, ORIGENES_POLITICA),
    categorias: listaDeCodigos(o, 'categorias', ruta, 1),
    servicios: listaDeCodigos(o, 'servicios', ruta, 1),
    versiones,
  };
}

/** Valida la semilla completa: forma, unicidad, referencias entre nodos y anonimizacion. */
export function validarSemilla(datos: unknown): SemillaConocimiento {
  const raiz = comoObjeto(datos, 'semilla', [
    'versionSemilla',
    'instanteBase',
    'notas',
    'servicios',
    'componentes',
    'estadosIniciales',
    'categorias',
    'politicas',
  ]);
  const notas = comoLista(raiz['notas'], 'semilla.notas', 0).map((v, i) =>
    verificarTexto(v, `semilla.notas[${i}]`),
  );
  const servicios = comoLista(raiz['servicios'], 'semilla.servicios', 1).map((v, i) =>
    validarServicio(v, `semilla.servicios[${i}]`),
  );
  const componentes = comoLista(raiz['componentes'], 'semilla.componentes', 1).map((v, i) =>
    validarComponente(v, `semilla.componentes[${i}]`),
  );
  const estadosIniciales = comoLista(raiz['estadosIniciales'], 'semilla.estadosIniciales', 1).map(
    (v, i) => validarEstadoInicial(v, `semilla.estadosIniciales[${i}]`),
  );
  const categorias = comoLista(raiz['categorias'], 'semilla.categorias', 1).map((v, i) =>
    validarCategoria(v, `semilla.categorias[${i}]`),
  );
  const politicas = comoLista(raiz['politicas'], 'semilla.politicas', 1).map((v, i) =>
    validarPolitica(v, `semilla.politicas[${i}]`),
  );

  const codigosServicio = servicios.map((s) => s.codigo);
  const codigosComponente = componentes.map((c) => c.codigo);
  const codigosCategoria = categorias.map((c) => c.codigo);
  verificarUnicos(codigosServicio, 'semilla.servicios');
  verificarUnicos(codigosComponente, 'semilla.componentes');
  verificarUnicos(codigosCategoria, 'semilla.categorias');
  verificarUnicos(
    politicas.map((p) => p.codigo),
    'semilla.politicas',
  );
  verificarUnicos(
    estadosIniciales.map((e) => e.codigo),
    'semilla.estadosIniciales',
  );

  const setServicios = new Set(codigosServicio);
  const setComponentes = new Set(codigosComponente);
  const setCategorias = new Set(codigosCategoria);
  servicios.forEach((s, i) =>
    verificarReferencias(
      s.componentes,
      setComponentes,
      `semilla.servicios[${i}].componentes`,
      'componente',
    ),
  );
  politicas.forEach((p, i) => {
    verificarReferencias(
      p.categorias,
      setCategorias,
      `semilla.politicas[${i}].categorias`,
      'categoria',
    );
    verificarReferencias(
      p.servicios,
      setServicios,
      `semilla.politicas[${i}].servicios`,
      'servicio',
    );
  });

  // Cada componente pertenece a exactamente un servicio (ver `Componente`).
  const duenoDe = new Map<string, string>();
  for (const s of servicios) {
    for (const c of s.componentes) {
      const otro = duenoDe.get(c);
      if (otro !== undefined) {
        fallar('semilla.servicios', `el componente «${c}» pertenece a «${otro}» y a «${s.codigo}»`);
      }
      duenoDe.set(c, s.codigo);
    }
  }
  componentes.forEach((c, i) => {
    if (!duenoDe.has(c.codigo)) {
      fallar(
        `semilla.componentes[${i}]`,
        `el componente «${c.codigo}» no pertenece a ningun servicio`,
      );
    }
  });

  estadosIniciales.forEach((e, i) =>
    e.afectaciones.forEach((a, j) => {
      const ruta = `semilla.estadosIniciales[${i}].afectaciones[${j}]`;
      verificarReferencias([a.servicio], setServicios, ruta, 'servicio');
      for (const c of a.componentesAfectados) {
        if (duenoDe.get(c) !== a.servicio) {
          fallar(ruta, `el componente «${c}» no es del servicio «${a.servicio}»`);
        }
      }
    }),
  );
  const base = estadosIniciales.find((e) => e.codigo === ESTADO_INICIAL_BASE);
  if (base === undefined || base.afectaciones.length > 0) {
    fallar(
      'semilla.estadosIniciales',
      `debe existir «${ESTADO_INICIAL_BASE}» y no tener afectaciones`,
    );
  }

  return {
    versionSemilla: texto(raiz, 'versionSemilla', 'semilla'),
    instanteBase: instante(raiz, 'instanteBase', 'semilla'),
    notas,
    servicios,
    componentes,
    estadosIniciales,
    categorias,
    politicas,
  };
}

/**
 * Expande la semilla a filas para una variante: aplica el estado inicial a
 * servicios y componentes, deja fuera las politicas adversariales si el corpus es
 * `estandar`, une los extractos y calcula la posicion exacta de cada uno (HU-05).
 *
 * @throws SeleccionEstadoInvalidaError si el estado inicial o el corpus no existen.
 */
export function construirEstadoConocimiento(
  semilla: SemillaConocimiento,
  seleccion: Partial<SeleccionEstado> = {},
): EstadoConocimiento {
  const estadoInicial = seleccion.estadoInicial ?? ESTADO_INICIAL_BASE;
  const corpus = seleccion.corpus ?? 'estandar';
  const variante = semilla.estadosIniciales.find((e) => e.codigo === estadoInicial);
  if (variante === undefined) {
    throw new SeleccionEstadoInvalidaError(
      `El estado inicial «${estadoInicial}» no existe. Disponibles: ${semilla.estadosIniciales
        .map((e) => e.codigo)
        .join(', ')}.`,
    );
  }
  if (!CORPUS_CONOCIMIENTO.includes(corpus)) {
    throw new SeleccionEstadoInvalidaError(
      `El corpus «${String(corpus)}» no existe. Disponibles: ${CORPUS_CONOCIMIENTO.join(', ')}.`,
    );
  }

  const estadosServicio: EstadoServicio[] = semilla.servicios.map((s) => {
    const a = variante.afectaciones.find((x) => x.servicio === s.codigo);
    return a === undefined
      ? {
          servicioCodigo: s.codigo,
          estado: 'operativo',
          alcance: null,
          mensaje: null,
          ventanaEstimada: null,
          incidenteRef: null,
          desde: semilla.instanteBase,
        }
      : {
          servicioCodigo: s.codigo,
          estado: a.estado,
          alcance: a.alcance,
          mensaje: a.mensaje,
          ventanaEstimada: a.ventanaEstimada,
          incidenteRef: a.incidenteRef,
          desde: a.desde,
        };
  });

  const componentes: Componente[] = semilla.componentes.map((c) => {
    const a = variante.afectaciones.find((x) => x.componentesAfectados.includes(c.codigo));
    return a === undefined
      ? {
          ...c,
          estado: 'operativo',
          ventanaEstimada: null,
          incidenteRef: null,
          actualizadoEn: semilla.instanteBase,
        }
      : {
          ...c,
          estado: a.estado,
          ventanaEstimada: a.ventanaEstimada,
          incidenteRef: a.incidenteRef,
          actualizadoEn: a.desde,
        };
  });

  const politicas = semilla.politicas.filter((p) => corpus === 'adversarial' || !p.adversarial);
  const versiones: VersionPolitica[] = [];
  const extractos: Extracto[] = [];
  const largoSeparador = [...SEPARADOR_EXTRACTOS].length;

  for (const politica of politicas) {
    for (const version of politica.versiones) {
      let inicio = 0;
      version.extractos.forEach((textoExtracto, indice) => {
        const fin = inicio + [...textoExtracto].length;
        extractos.push({
          politicaCodigo: politica.codigo,
          version: version.version,
          ordinal: indice + 1,
          inicio,
          fin,
          texto: textoExtracto,
        });
        inicio = fin + largoSeparador;
      });
      versiones.push({
        politicaCodigo: politica.codigo,
        version: version.version,
        titulo: version.titulo,
        vigenteDesde: version.vigenteDesde,
        vigente: version.vigente,
        contenido: version.extractos.join(SEPARADOR_EXTRACTOS),
      });
    }
  }

  return {
    servicios: semilla.servicios.map(({ componentes: _componentes, ...servicio }) => servicio),
    estadosServicio,
    componentes,
    categorias: semilla.categorias,
    politicas: politicas.map(
      ({ categorias: _categorias, servicios: _servicios, versiones: _versiones, ...politica }) =>
        politica,
    ),
    versiones,
    extractos,
    serviciosComponentes: semilla.servicios.flatMap((s) =>
      s.componentes.map((componenteCodigo) => ({ servicioCodigo: s.codigo, componenteCodigo })),
    ),
    politicasCategorias: politicas.flatMap((p) =>
      p.categorias.map((categoriaCodigo) => ({ politicaCodigo: p.codigo, categoriaCodigo })),
    ),
    politicasServicios: politicas.flatMap((p) =>
      p.servicios.map((servicioCodigo) => ({ politicaCodigo: p.codigo, servicioCodigo })),
    ),
    entorno: { versionSemilla: semilla.versionSemilla, estadoInicial, corpus },
  };
}
