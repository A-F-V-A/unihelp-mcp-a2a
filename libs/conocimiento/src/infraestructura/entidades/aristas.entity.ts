/*
 * Entidades TypeORM de las aristas del grafo. Cada una es una tabla con clave
 * primaria compuesta y dos claves foraneas NOT NULL: no puede existir una
 * arista huerfana ni repetida (decision 16).
 */
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ESQUEMA_CONOCIMIENTO } from '../esquema';
import { CategoriaEntity, ComponenteEntity, PoliticaEntity, ServicioEntity } from './nodos.entity';

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'servicio_componente' })
export class ServicioComponenteEntity {
  @PrimaryColumn({ name: 'servicio_codigo', type: 'text' })
  servicioCodigo!: string;

  @PrimaryColumn({ name: 'componente_codigo', type: 'text' })
  componenteCodigo!: string;

  @ManyToOne(() => ServicioEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'servicio_codigo', referencedColumnName: 'codigo' })
  servicio?: ServicioEntity;

  @ManyToOne(() => ComponenteEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'componente_codigo', referencedColumnName: 'codigo' })
  componente?: ComponenteEntity;
}

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'politica_categoria' })
export class PoliticaCategoriaEntity {
  @PrimaryColumn({ name: 'politica_codigo', type: 'text' })
  politicaCodigo!: string;

  @PrimaryColumn({ name: 'categoria_codigo', type: 'text' })
  categoriaCodigo!: string;

  @ManyToOne(() => PoliticaEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'politica_codigo', referencedColumnName: 'codigo' })
  politica?: PoliticaEntity;

  @ManyToOne(() => CategoriaEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoria_codigo', referencedColumnName: 'codigo' })
  categoria?: CategoriaEntity;
}

@Entity({ schema: ESQUEMA_CONOCIMIENTO, name: 'politica_servicio' })
export class PoliticaServicioEntity {
  @PrimaryColumn({ name: 'politica_codigo', type: 'text' })
  politicaCodigo!: string;

  @PrimaryColumn({ name: 'servicio_codigo', type: 'text' })
  servicioCodigo!: string;

  @ManyToOne(() => PoliticaEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'politica_codigo', referencedColumnName: 'codigo' })
  politica?: PoliticaEntity;

  @ManyToOne(() => ServicioEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'servicio_codigo', referencedColumnName: 'codigo' })
  servicio?: ServicioEntity;
}
