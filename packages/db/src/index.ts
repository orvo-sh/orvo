import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import * as schema from './schema/index.js';

const createDb = (databaseUrl: string) => drizzle(getDbClient(databaseUrl), { schema });

type Database = ReturnType<typeof createDb>;

const clients = new Map<string, Sql>();
const databases = new Map<string, Database>();

export const getDbClient = (databaseUrl: string) => {
  let client = clients.get(databaseUrl);

  if (!client) {
    client = postgres(databaseUrl);
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
