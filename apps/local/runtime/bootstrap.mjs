import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { startChDB } from './chdb.mjs';

const dataDir = process.env.ORVO_PGLITE_PATH;
const migrationsDir = process.env.ORVO_POSTGRES_MIGRATIONS;
const appEntry = process.env.ORVO_APP_ENTRY;
const clickhouseMigrationsDir = process.env.ORVO_CLICKHOUSE_MIGRATIONS;
const chdbPath = process.env.ORVO_CHDB_PATH;

if (!dataDir || !migrationsDir || !appEntry || !clickhouseMigrationsDir || !chdbPath) {
  throw new Error('Local runtime paths are not configured.');
}

const db = await PGlite.create(dataDir);
globalThis.__orvoPGlite = db;
await db.exec(`
  CREATE TABLE IF NOT EXISTS orvo_local_migration (
    name text PRIMARY KEY,
    applied_at timestamp NOT NULL DEFAULT now()
  )
`);

for (const name of (await readdir(migrationsDir))
  .filter((entry) => !entry.startsWith('._') && entry.endsWith('.sql'))
  .sort()) {
  const applied = await db.query('SELECT name FROM orvo_local_migration WHERE name = $1', [name]);

  if (applied.rows.length > 0) continue;

  await db.transaction(async (tx) => {
    await tx.exec(await readFile(path.join(migrationsDir, name), 'utf8'));
    await tx.query('INSERT INTO orvo_local_migration (name) VALUES ($1)', [name]);
  });
}

const socket = new PGLiteSocketServer({
  db,
  host: '127.0.0.1',
  port: Number(process.env.ORVO_POSTGRES_PORT ?? '54432')
});
await socket.start();
const chdb = await startChDB({
  dataDir: chdbPath,
  migrationsDir: clickhouseMigrationsDir,
  port: Number(process.env.ORVO_CLICKHOUSE_PORT ?? '58123')
});

const shutdown = async () => {
  await chdb.close();
  await socket.stop();
  await db.close();
};

process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

await import(pathToFileURL(path.resolve(appEntry)).href);
