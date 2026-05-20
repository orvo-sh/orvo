import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@clickhouse/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(packageRoot, 'migrations');
const migrationTable = 'schema_migrations';
const clickhouseUrl = process.env.CLICKHOUSE_URL;

if (!clickhouseUrl) {
  console.error('Missing CLICKHOUSE_URL');
  process.exit(1);
}

const client = createClient({ url: clickhouseUrl });

await client.command({
  query: `
    CREATE TABLE IF NOT EXISTS ${migrationTable} (
      version String,
      name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = MergeTree
    ORDER BY version
  `
});

const appliedRows = await (
  await client.query({
    query: `SELECT version FROM ${migrationTable} ORDER BY version`,
    format: 'JSONEachRow'
  })
).json();

const appliedVersions = new Set(appliedRows.map((row) => row.version));
const migrations = (await readdir(migrationsDir))
  .filter((file) => file.endsWith('.sql'))
  .sort();

for (const migration of migrations) {
  const version = migration.replace(/\.sql$/, '');

  if (appliedVersions.has(version)) {
    continue;
  }

  const sql = await readFile(path.join(migrationsDir, migration), 'utf8');
  const statements = sql
    .split(/^-- statement-breakpoint\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.command({ query: statement });
  }

  await client.insert({
    table: migrationTable,
    values: [{ version, name: migration }],
    format: 'JSONEachRow'
  });

  console.log(`Applied ${migration}`);
}

await client.close();
