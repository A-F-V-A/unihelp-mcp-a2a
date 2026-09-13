import { Injectable, inject } from '@angular/core';
import { CONFIGURACION_SIMULACION } from './configuracion-simulacion';
import { type EstadoBaseDatos, estadoInicial } from './estado-base-datos';
import { sembrarConversaciones } from './semillas';

export {
  type EstadoBaseDatos,
  type RegistroConversacion,
  generarId,
  resumirConversacion,
} from './estado-base-datos';

/** La version en la clave descarta datos guardados con una forma anterior. */
const CLAVE_ALMACEN = 'unihelp.mock.base-datos.v2';

/**
 * "Base de datos" del backend simulado: estado en memoria, con transacciones
 * atomicas (si la operacion lanza, no se aplica nada) y persistencia opcional
 * en `sessionStorage` para que las conversaciones sobrevivan a una recarga.
 */
@Injectable()
export class BaseDatosSimulada {
  private readonly config = inject(CONFIGURACION_SIMULACION);
  private estado: EstadoBaseDatos = this.cargar();

  transaccion<T>(operar: (estado: EstadoBaseDatos) => T): T {
    const copia = clonar(this.estado);
    const resultado = operar(copia);
    this.estado = copia;
    this.guardar(this.estado);
    return resultado;
  }

  consultar<T>(leer: (estado: Readonly<EstadoBaseDatos>) => T): T {
    return leer(this.estado);
  }

  private cargar(): EstadoBaseDatos {
    const guardado = this.config.persistirEnSesion ? leerGuardado() : null;
    if (guardado) {
      return guardado;
    }

    const nuevo = estadoInicial();
    if (this.config.sembrarConversaciones) {
      sembrarConversaciones(nuevo, this.config.turnosMaximos, new Date());
      this.guardar(nuevo);
    }
    return nuevo;
  }

  private guardar(estado: EstadoBaseDatos): void {
    if (!this.config.persistirEnSesion) {
      return;
    }
    try {
      sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    } catch {
      // Sin almacenamiento la simulacion sigue funcionando en memoria.
    }
  }
}

function leerGuardado(): EstadoBaseDatos | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE_ALMACEN);
    return crudo ? { ...estadoInicial(), ...(JSON.parse(crudo) as EstadoBaseDatos) } : null;
  } catch {
    return null;
  }
}

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}
