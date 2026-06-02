import { defineConfig } from 'drizzle-kit';

// quick hack lol :)
declare const process: {
  env: Record<string, string | undefined>;
};

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error('Missing POSTGRES_URL');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl
  },
  verbose: true,
  strict: true
});
