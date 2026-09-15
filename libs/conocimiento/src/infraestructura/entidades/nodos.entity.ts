/*
 * Entidades TypeORM de los nodos. Solo describen las tablas para escribirlas:
 * el esquema lo crean las migraciones (`synchronize` desactivado) y las lecturas
 * usan SQL explicito para controlar el orden y el formato de cada columna.
 */
import { AREAS_SERVICIO, NIVELES_ESTADO_SERVICIO } from '@unihelp/dominio';
import type { AreaServicio, NivelEstadoServicio } from '@unihelp/dominio';
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { ALCANCES_AFECTACION } from '../../dominio/estado-servicio';
import type { AlcanceAfectacion } from '../../dominio/estado-servicio';
import { CORPUS_CONOCIMIENTO } from '../../dominio/grafo';
import type { CorpusConocimiento } from '../../dominio/grafo';
import type { OrigenPolitica } from '../../dominio/politica';
import { NIVELES_SERVICIO } from '../../dominio/servicio';
import type { NivelServicio } from '../../dominio/servicio';
import { ESQUEMA_CONOCIMIENTO } from '../esquema';

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'servicios' })
export class ServicioEntity {
  @PrimaryColumn({ type: 'text' })
  codigo!: string;

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ type: 'text' })
  descripcion!: string;

  @Column({ name: 'unidad_responsable', type: 'text' })
  unidadResponsable!: string;

  @Column({ type: 'enum', enum: [...AREAS_SERVICIO], enumName: 'area_servicio' })
  area!: AreaServicio;

  @Column({
    name: 'nivel_servicio',
    type: 'enum',
    enum: [...NIVELES_SERVICIO],
    enumName: 'nivel_servicio',
  })
  nivelServicio!: NivelServicio;
}

/** Estado publicado de un servicio: relacion uno a uno con `servicios`. */
@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'estados_servicio' })
export class EstadoServicioEntity {
  @PrimaryColumn({ name: 'servicio_codigo', type: 'text' })
  servicioCodigo!: string;

  @OneToOne(() => ServicioEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'servicio_codigo', referencedColumnName: 'codigo' })
  servicio?: ServicioEntity;

  @Column({ type: 'enum', enum: [...NIVELES_ESTADO_SERVICIO], enumName: 'nivel_estado_servicio' })
  estado!: NivelEstadoServicio;

  @Column({
    type: 'enum',
    enum: [...ALCANCES_AFECTACION],
    enumName: 'alcance_afectacion',
    nullable: true,
  })
  alcance!: AlcanceAfectacion | null;

  @Column({ type: 'text', nullable: true })
  mensaje!: string | null;

  /** ISO 8601 UTC. */
  @Column({ name: 'ventana_inicio', type: 'timestamptz', nullable: true })
  ventanaInicio!: string | null;

  /** ISO 8601 UTC. */
  @Column({ name: 'ventana_fin', type: 'timestamptz', nullable: true })
  ventanaFin!: string | null;

  @Column({ name: 'incidente_ref', type: 'text', nullable: true })
  incidenteRef!: string | null;

  /** ISO 8601 UTC. */
  @Column({ type: 'timestamptz' })
  desde!: string;
}

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'componentes' })
export class ComponenteEntity {
  @PrimaryColumn({ type: 'text' })
  codigo!: string;

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ type: 'enum', enum: [...NIVELES_ESTADO_SERVICIO], enumName: 'nivel_estado_servicio' })
  estado!: NivelEstadoServicio;

  /** ISO 8601 UTC. */
  @Column({ name: 'ventana_inicio', type: 'timestamptz', nullable: true })
  ventanaInicio!: string | null;

  /** ISO 8601 UTC. */
  @Column({ name: 'ventana_fin', type: 'timestamptz', nullable: true })
  ventanaFin!: string | null;

  @Column({ name: 'incidente_ref', type: 'text', nullable: true })
  incidenteRef!: string | null;

  /** ISO 8601 UTC. */
  @Column({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: string;
}

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'categorias' })
export class CategoriaEntity {
  @PrimaryColumn({ type: 'text' })
  codigo!: string;

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ type: 'text' })
  descripcion!: string;
}

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'politicas' })
export class PoliticaEntity {
  @PrimaryColumn({ type: 'text' })
  codigo!: string;

  @Column({ type: 'text' })
  alcance!: string;

  @Column({ name: 'dependencia_responsable', type: 'text' })
  dependenciaResponsable!: string;

  @Column({ type: 'text', nullable: true })
  enlace!: string | null;

  @Column({ type: 'boolean' })
  adversarial!: boolean;

  @Column({ type: 'text' })
  origen!: OrigenPolitica;
}

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'versiones_politica' })
export class VersionPoliticaEntity {
  @PrimaryColumn({ name: 'politica_codigo', type: 'text' })
  politicaCodigo!: string;

  @PrimaryColumn({ type: 'text' })
  version!: string;

  @ManyToOne(() => PoliticaEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'politica_codigo', referencedColumnName: 'codigo' })
  politica?: PoliticaEntity;

  @Column({ type: 'text' })
  titulo!: string;

  /** `YYYY-MM-DD`. */
  @Column({ name: 'vigente_desde', type: 'date' })
  vigenteDesde!: string;

  @Column({ type: 'boolean' })
  vigente!: boolean;

  @Column({ type: 'text' })
  contenido!: string;

  /** Columna generada por PostgreSQL (titulo con peso A, contenido con peso D). */
  @Column({ type: 'tsvector', select: false, insert: false, update: false })
  tsv?: string;
}

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'extractos' })
export class ExtractoEntity {
  @PrimaryColumn({ name: 'politica_codigo', type: 'text' })
  politicaCodigo!: string;

  @PrimaryColumn({ type: 'text' })
  version!: string;

  @PrimaryColumn({ type: 'integer' })
  ordinal!: number;

  @ManyToOne(() => VersionPoliticaEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'politica_codigo', referencedColumnName: 'politicaCodigo' },
    { name: 'version', referencedColumnName: 'version' },
  ])
  versionPolitica?: VersionPoliticaEntity;

  @Column({ type: 'integer' })
  inicio!: number;

  @Column({ type: 'integer' })
  fin!: number;

  @Column({ type: 'text' })
  texto!: string;

  /** Columna generada por PostgreSQL. */
  @Column({ type: 'tsvector', select: false, insert: false, update: false })
  tsv?: string;
}

/** Fila unica que dice que variante de la semilla esta cargada. */
@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'entorno' })
export class EntornoEntity {
  @PrimaryColumn({ type: 'boolean' })
  unico!: boolean;

  @Column({ name: 'version_semilla', type: 'text' })
  versionSemilla!: string;

  @Column({ name: 'estado_inicial', type: 'text' })
  estadoInicial!: string;

  @Column({ type: 'enum', enum: [...CORPUS_CONOCIMIENTO], enumName: 'corpus' })
  corpus!: CorpusConocimiento;
}
