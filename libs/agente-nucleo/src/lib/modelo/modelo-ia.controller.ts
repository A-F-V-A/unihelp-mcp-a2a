import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import type { ConfiguracionModeloIaDto } from '@unihelp/contratos';
import { ConfiguracionModeloRuntime } from './configuracion-modelo-runtime';

/**
 * `GET` y `PUT /api/modelo-ia`: que proveedores hay, cual esta elegido y cual
 * puede elegirse. La clave del proveedor NUNCA entra ni sale por aqui: vive en
 * el servidor (decision 27).
 */
@Controller('modelo-ia')
export class ModeloIaController {
  constructor(
    @Inject(ConfiguracionModeloRuntime) private readonly modelo: ConfiguracionModeloRuntime,
  ) {}

  @Get()
  consultar(): ConfiguracionModeloIaDto {
    return this.modelo.estado();
  }

  @Put()
  seleccionar(@Body() cuerpo: unknown): ConfiguracionModeloIaDto {
    return this.modelo.seleccionar(cuerpo);
  }
}
