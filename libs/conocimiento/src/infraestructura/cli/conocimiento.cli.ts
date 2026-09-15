/**
 * CLI de la base de conocimiento, sin NestJS. Se invoca con `pnpm conocimiento:<comando>`:
 *
 *   migrar                              crea o actualiza el esquema
 *   sembrar                             carga la semilla base en una base vacia (idempotente)
 *   restablecer [estado] [corpus]       borra y repuebla una variante (perfil de experimento)
 *   huella                              huella y conteos de lo que hay en la base
 *   huellas                             huellas esperadas de todas las variantes, sin base de datos
 *
 * Lee `CONOCIMIENTO_DATABASE_URL`; si no existe usa la base local del profile
 * `conocimiento` de Docker Compose.
 */
import 'reflect-metadata';
import {
  resolverConfiguracionConocimiento,
  VARIABLES_CONOCIMIENTO,
} from '../../aplicacion/configuracion';
import { calcularHuella } from '../../aplicacion/huella';
import { calcularHuellasEsperadas } from '../../aplicacion/huellas-esperadas';
import { RestablecerConocimientoUseCase } from '../../aplicacion/restablecer-conocimiento.use-case';
import { SembrarConocimientoUseCase } from '../../aplicacion/sembrar-conocimiento.use-case';
import type { CorpusConocimiento } from '../../dominio/grafo';
import { contarFilas } from '../../dominio/reglas/estado-canonico.rules';
import { cargarSemillaConocimiento } from '../cargar-semilla';
import { abrirDataSourceConocimiento } from '../data-source';
import { TypeOrmConocimientoRepository } from '../typeorm-conocimiento.repository';

const URL_DESARROLLO_LOCAL = 'postgres://unihelp:unihelp@localhost:5432/unihelp';
const COMANDOS = ['migrar', 'sembrar', 'restablecer', 'huella', 'huellas'] as const;
type Comando = (typeof COMANDOS)[number];

function ocultarClave(url: string): string {
  try {
    const u = new URL(url);
    if (u.password !== '') {
      u.password = '***';
    }
    return u.toString();
  } catch {
    return '(URL inválida)';
  }
}

async function ejecutarConBase(comando: Exclude<Comando, 'huellas'>): Promise<unknown> {
  const configuracion = resolverConfiguracionConocimiento(
    { urlBaseDatos: process.env[VARIABLES_CONOCIMIENTO.urlBaseDatos] ?? URL_DESARROLLO_LOCAL },
    process.env,
  );
  console.error(`[conocimiento] ${comando} en ${ocultarClave(configuracion.urlBaseDatos)}`);
  const dataSource = await abrirDataSourceConocimiento(configuracion.urlBaseDatos);
  try {
    const repositorio = new TypeOrmConocimientoRepository(dataSource);
    const semilla = cargarSemillaConocimiento();
    switch (comando) {
      case 'migrar': {
        const aplicadas = await dataSource.runMigrations({ transaction: 'each' });
        return { migracionesAplicadas: aplicadas.map((m) => m.name) };
      }
      // `return await`: sin el await, el `finally` cerraria la conexion antes de terminar.
      case 'sembrar':
        return await new SembrarConocimientoUseCase(repositorio, semilla).ejecutar();
      case 'restablecer':
        return await new RestablecerConocimientoUseCase(
          repositorio,
          configuracion,
          semilla,
        ).ejecutar({
          estadoInicial: process.argv[3],
          // El caso de uso valida el valor: un corpus desconocido no escribe nada.
          corpus: process.argv[4] as CorpusConocimiento | undefined,
        });
      case 'huella': {
        const estado = await repositorio.leerEstado();
        return {
          huella: calcularHuella(estado),
          entorno: estado.entorno,
          conteos: contarFilas(estado),
        };
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

async function principal(): Promise<void> {
  const comando = COMANDOS.find((c): c is Comando => c === process.argv[2]);
  if (comando === undefined) {
    throw new Error(`Uso: conocimiento.cli.ts <${COMANDOS.join('|')}>`);
  }
  const resultado =
    comando === 'huellas'
      ? calcularHuellasEsperadas(cargarSemillaConocimiento())
      : await ejecutarConBase(comando);
  console.log(JSON.stringify(resultado, null, 2));
}

principal().catch((error: unknown) => {
  console.error(
    `[conocimiento] ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
  );
  process.exitCode = 1;
});
