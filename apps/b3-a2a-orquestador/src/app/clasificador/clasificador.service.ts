import { Injectable, Logger } from '@nestjs/common';

export type TipoSolicitud = 'informativa' | 'diagnostico' | 'compuesta' | 'fuera_de_alcance';

/**
 * Clasificador determinista de solicitudes para el orquestador B3 (HU-02, HU-03, RM-04).
 *
 * Categoriza la solicitud en uno de los cuatro tipos para decidir a que especialistas
 * delegar a traves del protocolo A2A v1.0.
 */
@Injectable()
export class ClasificadorService {
  private readonly logger = new Logger(ClasificadorService.name);

  clasificar(texto: string): TipoSolicitud {
    const t = texto.toLowerCase();

    // Palabras clave tipicas de diagnostico o falla tecnica
    const esDiagnostico =
      t.includes('lento') ||
      t.includes('lentitud') ||
      t.includes('caido') ||
      t.includes('caída') ||
      t.includes('error') ||
      t.includes('falla') ||
      t.includes('funciona') ||
      t.includes('no puedo') ||
      t.includes('problema') ||
      t.includes('estado') ||
      t.includes('rebota') ||
      t.includes('bloqueada') ||
      t.includes('subir');

    // Palabras clave tipicas de consulta informativa / normativa
    const esInformativa =
      t.includes('politica') ||
      t.includes('política') ||
      t.includes('plazo') ||
      t.includes('procedimiento') ||
      t.includes('requisito') ||
      t.includes('norma') ||
      t.includes('reglamento') ||
      t.includes('prórroga') ||
      t.includes('prorroga') ||
      t.includes('cancelar') ||
      t.includes('como ') ||
      t.includes('cómo ') ||
      t.includes('cuando ') ||
      t.includes('cuándo ') ||
      t.includes('reactivacion') ||
      t.includes('reactivación');

    if (esDiagnostico && esInformativa) {
      this.logger.log(`Solicitud clasificada como «compuesta»: «${texto.slice(0, 40)}...»`);
      return 'compuesta';
    }
    if (esDiagnostico) {
      this.logger.log(`Solicitud clasificada como «diagnostico»: «${texto.slice(0, 40)}...»`);
      return 'diagnostico';
    }
    if (esInformativa) {
      this.logger.log(`Solicitud clasificada como «informativa»: «${texto.slice(0, 40)}...»`);
      return 'informativa';
    }

    // Por defecto informativa si no hay indicios de falla
    this.logger.log(`Solicitud clasificada por defecto como «informativa»: «${texto.slice(0, 40)}...»`);
    return 'informativa';
  }
}
