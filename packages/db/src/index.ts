import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Options, type PostgresType, type Sql } from 'postgres';

import * as schema from './schema/index.js';

const createDb = (databaseUrl: string) => drizzle(getDbClient(databaseUrl), { schema });

type Database = ReturnType<typeof createDb>;

const clients = new Map<string, Sql>();
const databases = new Map<string, Database>();

const getPostgresOptions = (databaseUrl: string): Options<Record<string, PostgresType>> => {
  const url = new URL(databaseUrl);
  const sslRootCertPath = url.searchParams.get('sslrootcert');

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
    client = postgres(databaseUrl, getPostgresOptions(databaseUrl));
    clients.set(databaseUrl, client);
  }

  return client;
};

export const getDb = (databaseUrl: string) => {
  let database = databases.get(databaseUrl);

  if (!database) {
    database = createDb(databaseUrl);
    databases.set(databaseUrl, database);
  }

  return database;
};

export { schema };
