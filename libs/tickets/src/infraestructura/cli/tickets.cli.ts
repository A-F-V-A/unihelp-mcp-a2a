/**
 * CLI de tickets y auditoria, sin NestJS: `pnpm tickets:migrar` crea o
 * actualiza los esquemas `tickets` y `auditoria`.
 *
 * Lee `TICKETS_DATABASE_URL`; si no existe usa la base local del profile
 * `conocimiento` de Docker Compose, la misma de la base de conocimiento.
 */
import 'reflect-metadata';
import { VARIABLES_TICKETS } from '../../aplicacion/configuracion';
import { abrirDataSourceTickets } from '../data-source';

const URL_DESARROLLO_LOCAL = 'postgres://unihelp:unihelp@localhost:5432/unihelp';

async function principal(): Promise<void> {
  const comando = process.argv[2];
  if (comando !== 'migrar') {
    throw new Error(`Comando desconocido «${comando ?? ''}». Único comando: migrar.`);
  }
  const dataSource = await abrirDataSourceTickets(
    process.env[VARIABLES_TICKETS.urlBaseDatos] ?? URL_DESARROLLO_LOCAL,
  );
  try {
    const aplicadas = await dataSource.runMigrations({ transaction: 'each' });
    console.log(JSON.stringify({ migracionesAplicadas: aplicadas.map((m) => m.name) }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

principal().catch((fallo: unknown) => {
  console.error(fallo instanceof Error ? fallo.message : fallo);
  process.exitCode = 1;
});
