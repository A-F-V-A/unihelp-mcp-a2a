import type { ConfiguracionModeloIaDto } from '@unihelp/contratos';
import type { CatalogoModeloIa } from '../../domain/models/modelo-ia';

/** DTO -> modelo. La forma coincide; el mapper mantiene el limite entre capas. */
export function mapearCatalogoModeloIa(dto: ConfiguracionModeloIaDto): CatalogoModeloIa {
  return {
    proveedores: dto.proveedores.map((proveedor) => ({
      id: proveedor.id,
      nombre: proveedor.nombre,
      descripcion: proveedor.descripcion,
      disponible: proveedor.disponible,
      motivoNoDisponible: proveedor.motivoNoDisponible,
      modelos: proveedor.modelos,
      modeloPorDefecto: proveedor.modeloPorDefecto,
    })),
    seleccion: { proveedor: dto.seleccion.proveedor, modelo: dto.seleccion.modelo },
    claveConfigurada: dto.claveConfigurada,
    editable: dto.editable,
  };
}
