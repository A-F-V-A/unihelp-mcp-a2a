import { Injectable } from '@nestjs/common';
import type { RespuestaSalud } from '@unihelp/contratos';
import { IDENTIDAD } from './identidad';

@Injectable()
export class SaludService {
  private readonly instanteArranque = Date.now();

  consultar(): RespuestaSalud {
    return {
      estado: 'ok',
      ...IDENTIDAD,
      version: process.env.UNIHELP_VERSION ?? '0.1.0',
      marcaTiempo: new Date().toISOString(),
      tiempoActividadSegundos: Math.round((Date.now() - this.instanteArranque) / 1000),
    };
  }
}
