import type { AreaServicio, NivelEstadoServicio } from '@unihelp/dominio';
import type { DataSource, EntityManager } from 'typeorm';
import { calcularHuella } from '../aplicacion/huella';
import type { PoliticaEncontrada } from '../dominio/busqueda';
import type { Componente } from '../dominio/componente';
import { EstadoInconsistenteError } from '../dominio/errores';
import type { AlcanceAfectacion, EstadoServicio } from '../dominio/estado-servicio';
import type {
  ComponentesDeServicio,
  CorpusConocimiento,
  EstadoConocimiento,
  PoliticasDeCategoria,
} from '../dominio/grafo';
import type { OrigenPolitica } from '../dominio/politica';
import type {
  CandidatosBusqueda,
  ConocimientoRepository,
  CriterioBusquedaPoliticas,
  SiembraRepositorio,
} from '../dominio/puertos/conocimiento.repository';
import { serializarEstadoCanonico } from '../dominio/reglas/estado-canonico.rules';
import type { NivelServicio, Servicio } from '../dominio/servicio';
import {
  PoliticaCategoriaEntity,
  PoliticaServicioEntity,
  ServicioComponenteEntity,
} from './entidades/aristas.entity';
import {
  CategoriaEntity,
  ComponenteEntity,
  EntornoEntity,
  EstadoServicioEntity,
  ExtractoEntity,
  PoliticaEntity,
  ServicioEntity,
  VersionPoliticaEntity,
} from './entidades/nodos.entity';
import { CONFIGURACION_TEXTO, TABLAS_CALIFICADAS } from './esquema';

/*
 * Reglas de determinismo que sigue TODO el SQL de este archivo (decision 17):
 * - Todo ORDER BY sobre texto usa COLLATE "C" (orden binario). Sin eso, el orden
 *   depende de la configuracion regional con la que se creo la base.
 * - Las relevancias se redondean a 6 decimales en `numeric`: los empates son
 *   exactos y el desempate por codigo se aplica de verdad.
 * - Los instantes y fechas se formatean con `to_char` en UTC, nunca con
 *   `::text` (que depende de DateStyle) ni como `Date` de JavaScript.
 */

const ISO_UTC = (columna: string) =>
  `to_char(${columna} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

/** Lexemas distintos de la consulta. Se descartan los que contienen `\`, que no se pueden citar en un tsquery. */
const SQL_LEXEMAS_CONSULTA = `
  SELECT coalesce(array_agg(lexema ORDER BY lexema COLLATE "C"), '{}'::text[]) AS lexemas
  FROM unnest(tsvector_to_array(to_tsvector('${CONFIGURACION_TEXTO}'::regconfig, $1::text))) AS lexema
  WHERE strpos(lexema, E'\\\\') = 0`;

const filtrosBusqueda = (servicio: string, categoria: string) => `
  AND (${servicio}::text IS NULL OR EXISTS (
    SELECT 1 FROM conocimiento.politica_servicio ps
    WHERE ps.politica_codigo = v.politica_codigo AND ps.servicio_codigo = ${servicio}::text))
  AND (${categoria}::text IS NULL OR EXISTS (
    SELECT 1 FROM conocimiento.politica_categoria pc
    WHERE pc.politica_codigo = v.politica_codigo AND pc.categoria_codigo = ${categoria}::text))`;

/** $1 tsquery, $2 servicio, $3 categoria. */
const SQL_CONTAR_COINCIDENCIAS = `
  SELECT count(*)::int AS coincidencias
  FROM conocimiento.versiones_politica v
  WHERE v.vigente AND v.tsv @@ $1::tsquery ${filtrosBusqueda('$2', '$3')}`;

/**
 * $1 tsquery (lexemas unidos con OR), $2 lexemas, $3 servicio, $4 categoria,
 * $5 umbral, $6 limite.
 *
 * relevancia = ts_rank(tsv, consulta, 32) x (lexemas de la consulta presentes / lexemas de la consulta)
 *
 * `ts_rank` con normalizacion 32 queda en [0, 1). La cobertura evita que una
 * consulta larga con una sola palabra en comun (p. ej. «matricula») puntue igual
 * que una consulta que coincide en casi todo (HU-07).
 */
const SQL_BUSCAR_POLITICAS = `
  WITH puntuadas AS (
    SELECT v.politica_codigo, v.version, v.titulo, p.alcance,
           round(
             ts_rank(v.tsv, $1::tsquery, 32)::numeric
             * (SELECT count(*) FROM unnest($2::text[]) AS l WHERE v.tsv @@ quote_literal(l)::tsquery)
             / cardinality($2::text[]),
             6) AS relevancia
    FROM conocimiento.versiones_politica v
    JOIN conocimiento.politicas p ON p.codigo = v.politica_codigo
    WHERE v.vigente AND v.tsv @@ $1::tsquery ${filtrosBusqueda('$3', '$4')}
  )
  SELECT o.politica_codigo, o.version, o.titulo, o.alcance, o.relevancia::text AS relevancia,
         ARRAY(SELECT pc.categoria_codigo FROM conocimiento.politica_categoria pc
               WHERE pc.politica_codigo = o.politica_codigo
               ORDER BY pc.categoria_codigo COLLATE "C") AS categorias,
         ARRAY(SELECT ps.servicio_codigo FROM conocimiento.politica_servicio ps
               WHERE ps.politica_codigo = o.politica_codigo
               ORDER BY ps.servicio_codigo COLLATE "C") AS servicios,
         ex.ordinal, ex.inicio, ex.fin, ex.texto
  FROM puntuadas o
  CROSS JOIN LATERAL (
    SELECT e.ordinal, e.inicio, e.fin, e.texto
    FROM conocimiento.extractos e
    WHERE e.politica_codigo = o.politica_codigo AND e.version = o.version
    ORDER BY round(ts_rank(e.tsv, $1::tsquery, 32)::numeric, 6) DESC, e.ordinal ASC
    LIMIT 1
  ) ex
  WHERE o.relevancia >= $5::numeric
  ORDER BY o.relevancia DESC, o.politica_codigo COLLATE "C" ASC
  LIMIT $6::int`;

const COLUMNAS_SERVICIO = `codigo, nombre, descripcion, unidad_responsable, area::text AS area,
  nivel_servicio::text AS nivel_servicio`;

const COLUMNAS_ESTADO_SERVICIO = `
  servicio_codigo, estado::text AS estado, alcance::text AS alcance, mensaje,
  ${ISO_UTC('ventana_inicio')} AS ventana_inicio, ${ISO_UTC('ventana_fin')} AS ventana_fin,
  incidente_ref, ${ISO_UTC('desde')} AS desde`;

const COLUMNAS_COMPONENTE = `
  c.codigo, c.nombre, c.estado::text AS estado,
  ${ISO_UTC('c.ventana_inicio')} AS ventana_inicio, ${ISO_UTC('c.ventana_fin')} AS ventana_fin,
  c.incidente_ref, ${ISO_UTC('c.actualizado_en')} AS actualizado_en`;

const SQL_SERVICIO = `SELECT ${COLUMNAS_SERVICIO} FROM conocimiento.servicios WHERE codigo = $1::text`;

const SQL_ESTADO_SERVICIO = `
  SELECT ${COLUMNAS_ESTADO_SERVICIO} FROM conocimiento.estados_servicio WHERE servicio_codigo = $1::text`;

const SQL_COMPONENTES_DE_SERVICIO = `
  SELECT ${COLUMNAS_COMPONENTE}
  FROM conocimiento.servicio_componente sc
  JOIN conocimiento.componentes c ON c.codigo = sc.componente_codigo
  WHERE sc.servicio_codigo = $1::text
  ORDER BY c.codigo COLLATE "C"`;

const SQL_CATEGORIA = `SELECT codigo, nombre, descripcion FROM conocimiento.categorias WHERE codigo = $1::text`;

const SQL_POLITICAS_DE_CATEGORIA = `
  SELECT v.politica_codigo AS codigo, v.version, v.titulo, p.alcance
  FROM conocimiento.politica_categoria pc
  JOIN conocimiento.versiones_politica v ON v.politica_codigo = pc.politica_codigo AND v.vigente
  JOIN conocimiento.politicas p ON p.codigo = v.politica_codigo
  WHERE pc.categoria_codigo = $1::text
  ORDER BY v.politica_codigo COLLATE "C"`;

const SQL_TOTAL_FILAS = `SELECT (${TABLAS_CALIFICADAS.split(', ')
  .map((t) => `(SELECT count(*) FROM ${t})`)
  .join(' + ')})::int AS filas`;

const SQL_LEER_ESTADO = {
  servicios: `SELECT ${COLUMNAS_SERVICIO} FROM conocimiento.servicios ORDER BY codigo COLLATE "C"`,
  estadosServicio: `SELECT ${COLUMNAS_ESTADO_SERVICIO} FROM conocimiento.estados_servicio
                    ORDER BY servicio_codigo COLLATE "C"`,
  componentes: `SELECT ${COLUMNAS_COMPONENTE} FROM conocimiento.componentes c ORDER BY c.codigo COLLATE "C"`,
  categorias: `SELECT codigo, nombre, descripcion FROM conocimiento.categorias ORDER BY codigo COLLATE "C"`,
  politicas: `SELECT codigo, alcance, dependencia_responsable, enlace, adversarial, origen
              FROM conocimiento.politicas ORDER BY codigo COLLATE "C"`,
  versiones: `SELECT politica_codigo, version, titulo, to_char(vigente_desde, 'YYYY-MM-DD') AS vigente_desde,
                     vigente, contenido
              FROM conocimiento.versiones_politica
              ORDER BY politica_codigo COLLATE "C", version COLLATE "C"`,
  extractos: `SELECT politica_codigo, version, ordinal, inicio, fin, texto
              FROM conocimiento.extractos
              ORDER BY politica_codigo COLLATE "C", version COLLATE "C", ordinal`,
  serviciosComponentes: `SELECT servicio_codigo, componente_codigo FROM conocimiento.servicio_componente
                         ORDER BY servicio_codigo COLLATE "C", componente_codigo COLLATE "C"`,
  politicasCategorias: `SELECT politica_codigo, categoria_codigo FROM conocimiento.politica_categoria
                        ORDER BY politica_codigo COLLATE "C", categoria_codigo COLLATE "C"`,
  politicasServicios: `SELECT politica_codigo, servicio_codigo FROM conocimiento.politica_servicio
                       ORDER BY politica_codigo COLLATE "C", servicio_codigo COLLATE "C"`,
  entorno: `SELECT version_semilla, estado_inicial, corpus::text AS corpus FROM conocimiento.entorno`,
} as const;

interface FilaServicio {
  codigo: string;
  nombre: string;
  descripcion: string;
  unidad_responsable: string;
  area: AreaServicio;
  nivel_servicio: NivelServicio;
}

interface FilaEstadoServicio {
  servicio_codigo: string;
  estado: NivelEstadoServicio;
  alcance: AlcanceAfectacion | null;
  mensaje: string | null;
  ventana_inicio: string | null;
  ventana_fin: string | null;
  incidente_ref: string | null;
  desde: string;
}

interface FilaComponente {
  codigo: string;
  nombre: string;
  estado: NivelEstadoServicio;
  ventana_inicio: string | null;
  ventana_fin: string | null;
  incidente_ref: string | null;
  actualizado_en: string;
}

interface FilaBusqueda {
  politica_codigo: string;
  version: string;
  titulo: string;
  alcance: string;
  relevancia: string;
  categorias: string[];
  servicios: string[];
  ordinal: number;
  inicio: number;
  fin: number;
  texto: string;
}

/** Cita un lexema como literal de tsquery; el mismo formato que `quote_literal` sin barras invertidas. */
function citarLexema(lexema: string): string {
  return `'${lexema.replaceAll("'", "''")}'`;
}

function ventana(inicio: string | null, fin: string | null) {
  return inicio !== null && fin !== null ? { inicio, fin } : null;
}

function mapearServicio(fila: FilaServicio): Servicio {
  return {
    codigo: fila.codigo,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    unidadResponsable: fila.unidad_responsable,
    area: fila.area,
    nivelServicio: fila.nivel_servicio,
  };
}

function mapearEstadoServicio(fila: FilaEstadoServicio): EstadoServicio {
  return {
    servicioCodigo: fila.servicio_codigo,
    estado: fila.estado,
    alcance: fila.alcance,
    mensaje: fila.mensaje,
    ventanaEstimada: ventana(fila.ventana_inicio, fila.ventana_fin),
    incidenteRef: fila.incidente_ref,
    desde: fila.desde,
  };
}

function mapearComponente(fila: FilaComponente): Componente {
  return {
    codigo: fila.codigo,
    nombre: fila.nombre,
    estado: fila.estado,
    ventanaEstimada: ventana(fila.ventana_inicio, fila.ventana_fin),
    incidenteRef: fila.incidente_ref,
    actualizadoEn: fila.actualizado_en,
  };
}

function mapearPoliticaEncontrada(fila: FilaBusqueda): PoliticaEncontrada {
  return {
    codigo: fila.politica_codigo,
    version: fila.version,
    titulo: fila.titulo,
    alcance: fila.alcance,
    categorias: fila.categorias,
    servicios: fila.servicios,
    relevancia: Number(fila.relevancia),
    extracto: { ordinal: fila.ordinal, inicio: fila.inicio, fin: fila.fin, texto: fila.texto },
  };
}

/** Implementacion PostgreSQL del puerto (decision 16). */
export class TypeOrmConocimientoRepository implements ConocimientoRepository {
  constructor(private readonly dataSource: DataSource) {}

  buscarPoliticasVigentes(criterio: CriterioBusquedaPoliticas): Promise<CandidatosBusqueda> {
    // Una sola instantanea: el conteo y los resultados ven los mismos datos.
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const [fila] = await m.query<{ lexemas: string[] }[]>(SQL_LEXEMAS_CONSULTA, [criterio.texto]);
      const lexemas = fila?.lexemas ?? [];
      const consultaNormalizada = lexemas.map(citarLexema).join(' | ');
      if (lexemas.length === 0) {
        return { consultaNormalizada, terminos: 0, coincidencias: 0, politicas: [] };
      }
      const [conteo] = await m.query<{ coincidencias: number }[]>(SQL_CONTAR_COINCIDENCIAS, [
        consultaNormalizada,
        criterio.servicio,
        criterio.categoria,
      ]);
      const filas = await m.query<FilaBusqueda[]>(SQL_BUSCAR_POLITICAS, [
        consultaNormalizada,
        lexemas,
        criterio.servicio,
        criterio.categoria,
        criterio.umbral,
        criterio.limite,
      ]);
      return {
        consultaNormalizada,
        terminos: lexemas.length,
        coincidencias: conteo?.coincidencias ?? 0,
        politicas: filas.map(mapearPoliticaEncontrada),
      };
    });
  }

  obtenerComponentesDeServicio(servicioCodigo: string): Promise<ComponentesDeServicio | null> {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const [servicio] = await m.query<FilaServicio[]>(SQL_SERVICIO, [servicioCodigo]);
      const [estado] = await m.query<FilaEstadoServicio[]>(SQL_ESTADO_SERVICIO, [servicioCodigo]);
      if (servicio === undefined || estado === undefined) {
        return null;
      }
      const componentes = await m.query<FilaComponente[]>(SQL_COMPONENTES_DE_SERVICIO, [
        servicioCodigo,
      ]);
      return {
        servicio: mapearServicio(servicio),
        estado: mapearEstadoServicio(estado),
        componentes: componentes.map(mapearComponente),
      };
    });
  }

  obtenerPoliticasDeCategoria(categoriaCodigo: string): Promise<PoliticasDeCategoria | null> {
    return this.dataSource.transaction('REPEATABLE READ', async (m) => {
      const [categoria] = await m.query<{ codigo: string; nombre: string; descripcion: string }[]>(
        SQL_CATEGORIA,
        [categoriaCodigo],
      );
      if (categoria === undefined) {
        return null;
      }
      const politicas = await m.query<
        { codigo: string; version: string; titulo: string; alcance: string }[]
      >(SQL_POLITICAS_DE_CATEGORIA, [categoriaCodigo]);
      return { categoria, politicas };
    });
  }

  sembrarSiVacia(estado: EstadoConocimiento): Promise<SiembraRepositorio> {
    return this.dataSource.transaction('SERIALIZABLE', async (m) => {
      // Nadie escribe ni lee a medias mientras se decide si sembrar.
      await m.query(`LOCK TABLE ${TABLAS_CALIFICADAS} IN ACCESS EXCLUSIVE MODE`);
      const [total] = await m.query<{ filas: number }[]>(SQL_TOTAL_FILAS);
      if (total?.filas === 0) {
        await this.insertar(m, estado);
        return { accion: 'sembrada', estado: await this.leerYVerificar(m, estado) };
      }
      return { accion: 'sin-cambios', estado: await this.leerYVerificar(m, estado) };
    });
  }

  restablecer(estado: EstadoConocimiento): Promise<EstadoConocimiento> {
    return this.dataSource.transaction('SERIALIZABLE', async (m) => {
      // TRUNCATE toma un bloqueo exclusivo: ninguna lectura concurrente ve la base vacia.
      await m.query(`TRUNCATE TABLE ${TABLAS_CALIFICADAS}`);
      await this.insertar(m, estado);
      return this.leerYVerificar(m, estado);
    });
  }

  leerEstado(): Promise<EstadoConocimiento> {
    return this.dataSource.transaction('REPEATABLE READ', (m) => this.leer(m));
  }

  /** Inserta nodos antes que aristas, en el orden de los arreglos recibidos. */
  private async insertar(m: EntityManager, estado: EstadoConocimiento): Promise<void> {
    const lotes: readonly (readonly [new () => object, readonly object[]])[] = [
      [ServicioEntity, estado.servicios],
      [
        EstadoServicioEntity,
        estado.estadosServicio.map(({ ventanaEstimada, ...e }) => ({
          ...e,
          ventanaInicio: ventanaEstimada?.inicio ?? null,
          ventanaFin: ventanaEstimada?.fin ?? null,
        })),
      ],
      [
        ComponenteEntity,
        estado.componentes.map(({ ventanaEstimada, ...c }) => ({
          ...c,
          ventanaInicio: ventanaEstimada?.inicio ?? null,
          ventanaFin: ventanaEstimada?.fin ?? null,
        })),
      ],
      [CategoriaEntity, estado.categorias],
      [PoliticaEntity, estado.politicas],
      [VersionPoliticaEntity, estado.versiones],
      [ExtractoEntity, estado.extractos],
      [ServicioComponenteEntity, estado.serviciosComponentes],
      [PoliticaCategoriaEntity, estado.politicasCategorias],
      [PoliticaServicioEntity, estado.politicasServicios],
      [EntornoEntity, [{ unico: true, ...estado.entorno }]],
    ];
    for (const [entidad, filas] of lotes) {
      if (filas.length > 0) {
        await m.insert(entidad, [...filas]);
      }
    }
  }

  /** Lee lo escrito en la misma transaccion y revierte si no es identico a lo pedido. */
  private async leerYVerificar(
    m: EntityManager,
    esperado: EstadoConocimiento,
  ): Promise<EstadoConocimiento> {
    const leido = await this.leer(m);
    if (serializarEstadoCanonico(leido) !== serializarEstadoCanonico(esperado)) {
      throw new EstadoInconsistenteError(calcularHuella(esperado), calcularHuella(leido));
    }
    return leido;
  }

  private async leer(m: EntityManager): Promise<EstadoConocimiento> {
    const q = <T>(sql: string) => m.query<T[]>(sql);
    const [entorno] = await q<{
      version_semilla: string;
      estado_inicial: string;
      corpus: CorpusConocimiento;
    }>(SQL_LEER_ESTADO.entorno);
    return {
      servicios: (await q<FilaServicio>(SQL_LEER_ESTADO.servicios)).map(mapearServicio),
      estadosServicio: (await q<FilaEstadoServicio>(SQL_LEER_ESTADO.estadosServicio)).map(
        mapearEstadoServicio,
      ),
      componentes: (await q<FilaComponente>(SQL_LEER_ESTADO.componentes)).map(mapearComponente),
      categorias: await q<{ codigo: string; nombre: string; descripcion: string }>(
        SQL_LEER_ESTADO.categorias,
      ),
      politicas: (
        await q<{
          codigo: string;
          alcance: string;
          dependencia_responsable: string;
          enlace: string | null;
          adversarial: boolean;
          origen: OrigenPolitica;
        }>(SQL_LEER_ESTADO.politicas)
      ).map((f) => ({
        codigo: f.codigo,
        alcance: f.alcance,
        dependenciaResponsable: f.dependencia_responsable,
        enlace: f.enlace,
        adversarial: f.adversarial,
        origen: f.origen,
      })),
      versiones: (
        await q<{
          politica_codigo: string;
          version: string;
          titulo: string;
          vigente_desde: string;
          vigente: boolean;
          contenido: string;
        }>(SQL_LEER_ESTADO.versiones)
      ).map((f) => ({
        politicaCodigo: f.politica_codigo,
        version: f.version,
        titulo: f.titulo,
        vigenteDesde: f.vigente_desde,
        vigente: f.vigente,
        contenido: f.contenido,
      })),
      extractos: (
        await q<{
          politica_codigo: string;
          version: string;
          ordinal: number;
          inicio: number;
          fin: number;
          texto: string;
        }>(SQL_LEER_ESTADO.extractos)
      ).map((f) => ({
        politicaCodigo: f.politica_codigo,
        version: f.version,
        ordinal: f.ordinal,
        inicio: f.inicio,
        fin: f.fin,
        texto: f.texto,
      })),
      serviciosComponentes: (
        await q<{ servicio_codigo: string; componente_codigo: string }>(
          SQL_LEER_ESTADO.serviciosComponentes,
        )
      ).map((f) => ({ servicioCodigo: f.servicio_codigo, componenteCodigo: f.componente_codigo })),
      politicasCategorias: (
        await q<{ politica_codigo: string; categoria_codigo: string }>(
          SQL_LEER_ESTADO.politicasCategorias,
        )
      ).map((f) => ({ politicaCodigo: f.politica_codigo, categoriaCodigo: f.categoria_codigo })),
      politicasServicios: (
        await q<{ politica_codigo: string; servicio_codigo: string }>(
          SQL_LEER_ESTADO.politicasServicios,
        )
      ).map((f) => ({ politicaCodigo: f.politica_codigo, servicioCodigo: f.servicio_codigo })),
      // Una base sin sembrar no tiene entorno: se representa vacio para que la
      // huella difiera de cualquier variante real.
      entorno:
        entorno === undefined
          ? { versionSemilla: '', estadoInicial: '', corpus: 'estandar' }
          : {
              versionSemilla: entorno.version_semilla,
              estadoInicial: entorno.estado_inicial,
              corpus: entorno.corpus,
            },
    };
  }
}
