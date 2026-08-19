import type { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readFileSync } from 'node:fs';
import postgres, { type Options, type PostgresType, type Sql } from 'postgres';
export { and, asc, count, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import * as schema from './schema/index.js';

const createDb = (databaseUrl: string) => drizzle(getDbClient(databaseUrl), { schema });

type Database = ReturnType<typeof createDb>;
export type DB = Database;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const clients = new Map<string, Sql>();
const databases = new Map<string, Database>();
const localRuntime = globalThis as typeof globalThis & { __orvoPGlite?: PGlite };

const getPostgresConnectionString = (databaseUrl: string) => {
  const url = new URL(databaseUrl);

  url.searchParams.delete('sslrootcert');
  url.searchParams.delete('sslmode');
  url.searchParams.delete('uselibpqcompat');
  url.searchParams.delete('orvo_local');

  return url.toString();
};

const getPostgresOptions = (databaseUrl: string): Options<Record<string, PostgresType>> => {
  const url = new URL(databaseUrl);
  const sslRootCertPath = url.searchParams.get('sslrootcert');

  if (url.searchParams.get('orvo_local') === 'true') {
    return {
      max: 1,
      onnotice: () => undefined
    };
  }

  if (!sslRootCertPath || sslRootCertPath === 'system') {
    return {};
  }

  const sslMode = url.searchParams.get('sslmode');

  return {
    ssl: {
      ca: readFileSync(sslRootCertPath, 'utf8'),
      rejectUnauthorized: sslMode !== 'require'
    }
  };
};

export const getDbClient = (databaseUrl: string) => {
  let client = clients.get(databaseUrl);

  if (!client) {
    client = postgres(getPostgresConnectionString(databaseUrl), getPostgresOptions(databaseUrl));
    clients.set(databaseUrl, client);
  }

  return client;
};

export const getDb = (databaseUrl: string) => {
  let database = databases.get(databaseUrl);

  if (!database) {
    if (databaseUrl === 'pglite://local') {
      if (!localRuntime.__orvoPGlite) {
        throw new Error('The embedded PGlite database is not initialized');
      }

      database = drizzlePglite(localRuntime.__orvoPGlite, { schema }) as unknown as Database;
    } else {
      database = createDb(databaseUrl);
    }
    databases.set(databaseUrl, database);
  }

  return database;
};

export { schema };
