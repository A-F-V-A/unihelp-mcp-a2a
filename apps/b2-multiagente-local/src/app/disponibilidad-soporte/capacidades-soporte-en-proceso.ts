import { Injectable } from '@nestjs/common';
import { comoTrasViajar } from '@unihelp/capacidades';
import {
  type ContextoInvocacion,
  type DescripcionCapacidad,
  EjecutorCapacidad,
  type PuertoCapacidades,
  type RegistradorAuditoria,
  type ResultadoInvocacion,
  ValidadorArgumentos,
  ahoraMonotonoMs,
} from '@unihelp/herramientas';
import type { SedeSoporte } from './calendario-soporte';
import {
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  consultarDisponibilidadSoporte,
} from './consultar-disponibilidad-soporte';

/**
 * La herramienta es de solo lectura y no toca ninguna base: no hay escritura que
 * auditar (RM-09 cubre las escrituras) ni conexion a PostgreSQL que abrir solo
 * para registrar una consulta de calendario.
 */
const SIN_AUDITORIA: RegistradorAuditoria = { registrar: async () => undefined };

/**
 * Capacidades propias del orquestador de B2 (decision 60): hoy solo
 * `consultar_disponibilidad_soporte`, atendida en el mismo proceso, que es el
 * protocolo de B2. Pasa por `EjecutorCapacidad` como cualquier receptor: valida
 * los argumentos contra el esquema, cuenta la llamada contra el limite, mide su
 * duracion y devuelve los errores tipados de docs/02, 5. El resultado pasa por
 * JSON, igual que `CapacidadesLocales` (RNF-01).
 */
@Injectable()
export class CapacidadesSoporteEnProceso implements PuertoCapacidades {
  private readonly ejecutor = new EjecutorCapacidad(
    new ValidadorArgumentos([DEFINICION_DISPONIBILIDAD_SOPORTE]),
    SIN_AUDITORIA,
  );

  async listar(): Promise<readonly DescripcionCapacidad[]> {
    const d = DEFINICION_DISPONIBILIDAD_SOPORTE;
    return [{ nombre: d.nombre, descripcion: d.descripcion, esquemaEntrada: d.esquemaEntrada }];
  }

  async invocar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
  ): Promise<ResultadoInvocacion> {
    const inicio = ahoraMonotonoMs();
    const resultado = await this.ejecutor.ejecutar(nombre, argumentos, contexto, async (a) => {
      const salida = consultarDisponibilidadSoporte(a['sede'] as SedeSoporte, String(a['fecha']));
      return { paraModelo: salida, estructurado: salida };
    });
    const rttMs = ahoraMonotonoMs() - inicio;
    if (!resultado.ok) {
      return { ...resultado, rttMs };
    }
    return {
      ...resultado,
      salida: {
        paraModelo: comoTrasViajar(resultado.salida.paraModelo),
        estructurado: comoTrasViajar(resultado.salida.estructurado),
      },
      rttMs,
    };
  }
}
