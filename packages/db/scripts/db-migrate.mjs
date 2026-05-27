import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(packageRoot, 'drizzle');
const journalPath = path.join(migrationsDir, 'meta', '_journal.json');

const postgresUrl = process.env.POSTGRES_URL;

if (!postgresUrl) {
  console.error('Missing POSTGRES_URL');
  process.exit(1);
}

const journal = JSON.parse(await readFile(journalPath, 'utf8'));
const pool = new Pool({ connectionString: postgresUrl });
const client = await pool.connect();

try {
  let baselined = false;

  await client.query('BEGIN');
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows } = await client.query(`
    SELECT created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const lastAppliedAt = rows[0] ? Number(rows[0].created_at) : null;

  if (lastAppliedAt === null) {
    const { rows: latestTableRows } = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ingestion_key'
      ) AS has_latest_schema
    `);
    const { rows: publicTableRows } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const hasLatestSchema = latestTableRows[0]?.has_latest_schema === true;
    const hasExistingPublicTables = publicTableRows.length > 0;

    if (hasLatestSchema) {
      for (const entry of journal.entries) {
        const migrationPath = path.join(migrationsDir, `${entry.tag}.sql`);
        const sql = await readFile(migrationPath, 'utf8');
        const hash = crypto.createHash('sha256').update(sql).digest('hex');

        await client.query(
          `
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES ($1, $2)
          `,
          [hash, entry.when]
        );
      }

      console.log('Baselined existing PostgreSQL schema into drizzle.__drizzle_migrations');
      baselined = true;
    }

    if (!baselined && hasExistingPublicTables) {
      throw new Error(
        `Refusing to apply migrations to a partially initialized database without migration history. Existing tables: ${publicTableRows
          .map((row) => row.table_name)
          .join(', ')}`
      );
    }
  }

  if (!baselined) {
    for (const entry of journal.entries) {
      if (lastAppliedAt !== null && lastAppliedAt >= entry.when) {
        continue;
      }

      const migrationPath = path.join(migrationsDir, `${entry.tag}.sql`);
      const sql = await readFile(migrationPath, 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean);
      const hash = crypto.createHash('sha256').update(sql).digest('hex');

      for (const statement of statements) {
        await client.query(statement);
      }

      await client.query(
        `
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES ($1, $2)
        `,
        [hash, entry.when]
      );

      console.log(`Applied ${entry.tag}.sql`);
    }
  }

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
