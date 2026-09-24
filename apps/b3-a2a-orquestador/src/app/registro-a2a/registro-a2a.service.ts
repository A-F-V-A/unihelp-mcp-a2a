import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { AgentCardDto } from '@unihelp/contratos';
import { RUTA_AGENT_CARD } from '@unihelp/contratos';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

interface RegistroEntradaConfig {
  readonly url: string;
}

interface RegistroYamlConfig {
  readonly agentes?: readonly RegistroEntradaConfig[];
}

/**
 * Resuelve variables de entorno con formato `${VAR:-default}` o `${VAR}`.
 */
export function expandirVariablesEntorno(cadena: string): string {
  return cadena.replace(/\$\{([^:-]+)(?::-([^}]*))?\}/g, (_, varName, defVal) => {
    const val = process.env[varName];
    return val !== undefined && val !== '' ? val : (defVal ?? '');
  });
}

/**
 * Servicio de descubrimiento y ruteo A2A del orquestador B3 (HU-29).
 *
 * Lee la configuracion de agentes especialistas en `config/a2a-registry.yaml`,
 * consulta su tarjeta Agent Card en `/.well-known/agent-card.json` y construye
 * una tabla de ruteo dinamica indexada por `skills[].id` (HU-29, D-41).
 */
@Injectable()
export class RegistroA2aService implements OnModuleInit {
  private readonly logger = new Logger(RegistroA2aService.name);
  private readonly habilidades = new Map<string, AgentCardDto>();
  private readonly agentesRegistrados = new Map<string, AgentCardDto>();

  async onModuleInit(): Promise<void> {
    await this.cargarRegistro();
  }

  /**
   * Resuelve el agente especialista capaz de atender una habilidad especifica (HU-29).
   */
  resolverAgentePorHabilidad(skillId: string): AgentCardDto | undefined {
    return this.habilidades.get(skillId);
  }

  /**
   * Lista todos los Agent Cards de especialistas descubiertos.
   */
  listarAgentes(): readonly AgentCardDto[] {
    return Array.from(this.agentesRegistrados.values());
  }

  /**
   * Registra manualmente una tarjeta de agente (util para pruebas o registro dinámico).
   */
  registrarAgente(card: AgentCardDto): void {
    this.agentesRegistrados.set(card.name, card);
    for (const skill of card.skills) {
      this.habilidades.set(skill.id, card);
      this.logger.log(`Habilidad «${skill.id}» registrada hacia «${card.name}» (${card.url})`);
    }
  }

  /**
   * Carga el archivo de configuracion YAML e inicializa el descubrimiento HTTP de las tarjetas.
   */
  async cargarRegistro(yamlContenido?: string): Promise<void> {
    let contenido = yamlContenido;

    if (!contenido) {
      const rutaArchivo = this.determinarRutaConfig();
      if (fs.existsSync(rutaArchivo)) {
        contenido = fs.readFileSync(rutaArchivo, 'utf-8');
      } else {
        this.logger.warn(
          `Archivo de registro no encontrado en ${rutaArchivo}. Usando configuracion por defecto.`,
        );
        contenido = `
agentes:
  - url: "\${A2A_CONOCIMIENTO_URL:-http://localhost:3004}"
  - url: "\${A2A_DIAGNOSTICO_URL:-http://localhost:3005}"
`;
      }
    }

    const parseado = YAML.parse(contenido) as RegistroYamlConfig | null;
    const entradas = parseado?.agentes ?? [];

    for (const entrada of entradas) {
      const urlBase = expandirVariablesEntorno(entrada.url).replace(/\/+$/, '');
      if (!urlBase) continue;

      try {
        await this.descubrirAgente(urlBase);
      } catch (error) {
        this.logger.warn(
          `No se pudo descubrir Agent Card en «${urlBase}»: ${(error as Error).message}`,
        );
      }
    }
  }

  private async descubrirAgente(urlBase: string): Promise<void> {
    const urlCard = `${urlBase}${RUTA_AGENT_CARD}`;
    this.logger.log(`Consultando Agent Card en ${urlCard}...`);

    const respuesta = await fetch(urlCard, {
      headers: { Accept: 'application/json' },
    });

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status} ${respuesta.statusText}`);
    }

    const card = (await respuesta.json()) as AgentCardDto;
    if (!card.skills || !Array.isArray(card.skills)) {
      throw new Error(`La respuesta de ${urlCard} no contiene una lista valida de skills.`);
    }

    this.registrarAgente(card);
  }

  private determinarRutaConfig(): string {
    if (process.env.A2A_REGISTRY_PATH) {
      return path.resolve(process.env.A2A_REGISTRY_PATH);
    }
    const candidatos = [
      path.resolve(process.cwd(), 'apps/b3-a2a-orquestador/config/a2a-registry.yaml'),
      path.resolve(process.cwd(), 'config/a2a-registry.yaml'),
      path.resolve(__dirname, '../../config/a2a-registry.yaml'),
      path.resolve(__dirname, '../../../config/a2a-registry.yaml'),
    ];

    for (const candidato of candidatos) {
      if (fs.existsSync(candidato)) {
        return candidato;
      }
    }

    return candidatos[0];
  }
}
