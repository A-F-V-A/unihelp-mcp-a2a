import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea el grafo de conocimiento: tablas de nodos, tablas de aristas, el estado
 * publicado de cada servicio, la fila de entorno y la configuracion de texto
 * completo en español. El diagrama esta en `docs/base-de-conocimiento.md`.
 *
 * Una migracion es una foto: los valores de los enum se escriben literales y no
 * se importan del codigo, para que cambiar el vocabulario no altere en silencio
 * una migracion ya aplicada. La prueba de integracion verifica que coincidan.
 */
export class CrearGrafoConocimiento1789344000000 implements MigrationInterface {
  name = 'CrearGrafoConocimiento1789344000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const sentencia of SUBIDA) {
      await queryRunner.query(sentencia);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP SCHEMA conocimiento CASCADE');
  }
}

/** Instantes con precision de segundos: la huella los serializa a segundos. */
const EN_SEGUNDOS = (columna: string, nula: boolean) =>
  nula
    ? `(${columna} IS NULL OR date_trunc('second', ${columna}) = ${columna})`
    : `date_trunc('second', ${columna}) = ${columna}`;

const SUBIDA: readonly string[] = [
  // unaccent es una extension "trusted" desde PostgreSQL 13: no exige superusuario.
  'CREATE EXTENSION IF NOT EXISTS unaccent',
  'CREATE SCHEMA conocimiento',

  `CREATE TEXT SEARCH CONFIGURATION conocimiento.espanol (COPY = pg_catalog.spanish)`,
  `ALTER TEXT SEARCH CONFIGURATION conocimiento.espanol
     ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem`,

  `CREATE TYPE conocimiento.nivel_estado_servicio AS ENUM
     ('operativo', 'degradado', 'interrumpido', 'mantenimiento')`,
  `CREATE TYPE conocimiento.area_servicio AS ENUM
     ('registro-academico', 'plataforma-virtual', 'soporte-tecnico', 'biblioteca',
      'bienestar-universitario', 'financiera', 'infraestructura-fisica')`,
  `CREATE TYPE conocimiento.nivel_servicio AS ENUM ('critico', 'alto', 'medio')`,
  `CREATE TYPE conocimiento.alcance_afectacion AS ENUM ('total', 'parcial', 'programado')`,
  `CREATE TYPE conocimiento.corpus AS ENUM ('estandar', 'adversarial')`,

  // ---------------------------------------------------------------- nodos
  `CREATE TABLE conocimiento.servicios (
     codigo              text PRIMARY KEY CHECK (codigo ~ '^[a-z][a-z0-9_]*$'),
     nombre              text NOT NULL,
     descripcion         text NOT NULL,
     unidad_responsable  text NOT NULL,
     area                conocimiento.area_servicio NOT NULL,
     nivel_servicio      conocimiento.nivel_servicio NOT NULL
   )`,

  `CREATE TABLE conocimiento.estados_servicio (
     servicio_codigo  text PRIMARY KEY REFERENCES conocimiento.servicios (codigo) ON DELETE RESTRICT,
     estado           conocimiento.nivel_estado_servicio NOT NULL,
     alcance          conocimiento.alcance_afectacion,
     mensaje          text,
     ventana_inicio   timestamptz,
     ventana_fin      timestamptz,
     incidente_ref    text CHECK (incidente_ref ~ '^(INC|MNT)-[0-9]{4}-[0-9]{4}$'),
     desde            timestamptz NOT NULL,
     CONSTRAINT estado_servicio_ventana_completa
       CHECK ((ventana_inicio IS NULL) = (ventana_fin IS NULL)),
     CONSTRAINT estado_servicio_ventana_ordenada CHECK (ventana_fin > ventana_inicio),
     -- Operativo = nada que comunicar. Afectado = siempre con alcance, comunicado y referencia.
     CONSTRAINT estado_servicio_operativo_sin_afectacion CHECK (
       (estado = 'operativo') = (alcance IS NULL)
       AND (estado = 'operativo') = (mensaje IS NULL)
       AND (estado = 'operativo') = (incidente_ref IS NULL)
       AND (estado <> 'operativo' OR ventana_inicio IS NULL)
     ),
     CONSTRAINT estado_servicio_mantenimiento_programado CHECK (
       (estado = 'mantenimiento') = coalesce(alcance = 'programado', false)
       AND (estado <> 'mantenimiento' OR ventana_inicio IS NOT NULL)
     ),
     CONSTRAINT estado_servicio_instantes_en_segundos CHECK (
       ${EN_SEGUNDOS('desde', false)}
       AND ${EN_SEGUNDOS('ventana_inicio', true)}
       AND ${EN_SEGUNDOS('ventana_fin', true)}
     )
   )`,

  `CREATE TABLE conocimiento.componentes (
     codigo          text PRIMARY KEY CHECK (codigo ~ '^[a-z][a-z0-9_]*$'),
     nombre          text NOT NULL,
     estado          conocimiento.nivel_estado_servicio NOT NULL,
     ventana_inicio  timestamptz,
     ventana_fin     timestamptz,
     incidente_ref   text,
     actualizado_en  timestamptz NOT NULL,
     CONSTRAINT componente_ventana_completa
       CHECK ((ventana_inicio IS NULL) = (ventana_fin IS NULL)),
     CONSTRAINT componente_ventana_ordenada
       CHECK (ventana_fin > ventana_inicio),
     CONSTRAINT componente_operativo_sin_incidente
       CHECK (estado <> 'operativo' OR (ventana_inicio IS NULL AND incidente_ref IS NULL)),
     CONSTRAINT componente_instantes_en_segundos CHECK (
       ${EN_SEGUNDOS('actualizado_en', false)}
       AND ${EN_SEGUNDOS('ventana_inicio', true)}
       AND ${EN_SEGUNDOS('ventana_fin', true)}
     )
   )`,

  `CREATE TABLE conocimiento.categorias (
     codigo       text PRIMARY KEY CHECK (codigo ~ '^[a-z][a-z0-9_]*$'),
     nombre       text NOT NULL,
     descripcion  text NOT NULL
   )`,

  `CREATE TABLE conocimiento.politicas (
     codigo                   text PRIMARY KEY CHECK (codigo ~ '^POL-[A-Z]{2}-[0-9]{3}$'),
     alcance                  text NOT NULL,
     dependencia_responsable  text NOT NULL,
     enlace                   text,
     adversarial              boolean NOT NULL,
     origen                   text NOT NULL CHECK (origen IN
                                ('conjunto-de-tareas', 'complemento-hu-kb-04', 'redactada-desde-tareas'))
   )`,

  `CREATE TABLE conocimiento.versiones_politica (
     politica_codigo  text NOT NULL REFERENCES conocimiento.politicas (codigo) ON DELETE RESTRICT,
     version          text NOT NULL CHECK (version ~ '^[0-9]+\\.[0-9]+$'),
     titulo           text NOT NULL,
     vigente_desde    date NOT NULL,
     vigente          boolean NOT NULL,
     contenido        text NOT NULL,
     tsv              tsvector GENERATED ALWAYS AS (
                        setweight(to_tsvector('conocimiento.espanol'::regconfig, titulo), 'A')
                        || setweight(to_tsvector('conocimiento.espanol'::regconfig, contenido), 'D')
                      ) STORED,
     PRIMARY KEY (politica_codigo, version)
   )`,
  // Como mucho una version vigente por politica; la semilla exige exactamente una.
  `CREATE UNIQUE INDEX version_politica_una_vigente
     ON conocimiento.versiones_politica (politica_codigo) WHERE vigente`,
  `CREATE INDEX version_politica_tsv ON conocimiento.versiones_politica USING gin (tsv)`,

  `CREATE TABLE conocimiento.extractos (
     politica_codigo  text NOT NULL,
     version          text NOT NULL,
     ordinal          integer NOT NULL CHECK (ordinal >= 1),
     inicio           integer NOT NULL CHECK (inicio >= 0),
     fin              integer NOT NULL,
     texto            text NOT NULL,
     tsv              tsvector GENERATED ALWAYS AS (
                        to_tsvector('conocimiento.espanol'::regconfig, texto)
                      ) STORED,
     PRIMARY KEY (politica_codigo, version, ordinal),
     FOREIGN KEY (politica_codigo, version)
       REFERENCES conocimiento.versiones_politica (politica_codigo, version) ON DELETE RESTRICT,
     CONSTRAINT extracto_rango_valido CHECK (fin > inicio AND char_length(texto) = fin - inicio),
     CONSTRAINT extracto_sin_solapes UNIQUE (politica_codigo, version, inicio)
   )`,

  // La posicion de un extracto es exacta o la fila no entra (HU-05).
  `CREATE FUNCTION conocimiento.verificar_posicion_extracto() RETURNS trigger
   LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM conocimiento.versiones_politica v
       WHERE v.politica_codigo = NEW.politica_codigo
         AND v.version = NEW.version
         AND substr(v.contenido, NEW.inicio + 1, NEW.fin - NEW.inicio) = NEW.texto
     ) THEN
       RAISE EXCEPTION 'El extracto %@% #% no coincide con el contenido en [%, %)',
         NEW.politica_codigo, NEW.version, NEW.ordinal, NEW.inicio, NEW.fin
         USING ERRCODE = 'check_violation';
     END IF;
     RETURN NEW;
   END
   $$`,
  `CREATE TRIGGER extracto_posicion_exacta
     BEFORE INSERT OR UPDATE ON conocimiento.extractos
     FOR EACH ROW EXECUTE FUNCTION conocimiento.verificar_posicion_extracto()`,

  // --------------------------------------------------------------- aristas
  `CREATE TABLE conocimiento.servicio_componente (
     servicio_codigo    text NOT NULL REFERENCES conocimiento.servicios (codigo) ON DELETE RESTRICT,
     componente_codigo  text NOT NULL REFERENCES conocimiento.componentes (codigo) ON DELETE RESTRICT,
     PRIMARY KEY (servicio_codigo, componente_codigo)
   )`,
  `CREATE INDEX servicio_componente_componente ON conocimiento.servicio_componente (componente_codigo)`,

  `CREATE TABLE conocimiento.politica_categoria (
     politica_codigo   text NOT NULL REFERENCES conocimiento.politicas (codigo) ON DELETE RESTRICT,
     categoria_codigo  text NOT NULL REFERENCES conocimiento.categorias (codigo) ON DELETE RESTRICT,
     PRIMARY KEY (politica_codigo, categoria_codigo)
   )`,
  `CREATE INDEX politica_categoria_categoria ON conocimiento.politica_categoria (categoria_codigo)`,

  `CREATE TABLE conocimiento.politica_servicio (
     politica_codigo  text NOT NULL REFERENCES conocimiento.politicas (codigo) ON DELETE RESTRICT,
     servicio_codigo  text NOT NULL REFERENCES conocimiento.servicios (codigo) ON DELETE RESTRICT,
     PRIMARY KEY (politica_codigo, servicio_codigo)
   )`,
  `CREATE INDEX politica_servicio_servicio ON conocimiento.politica_servicio (servicio_codigo)`,

  // --------------------------------------------------------------- entorno
  // Una sola fila: la clave es un booleano que solo admite true.
  `CREATE TABLE conocimiento.entorno (
     unico            boolean PRIMARY KEY CHECK (unico),
     version_semilla  text NOT NULL,
     estado_inicial   text NOT NULL CHECK (estado_inicial ~ '^[a-z][a-z0-9_]*$'),
     corpus           conocimiento.corpus NOT NULL
   )`,
];
