import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from '@repo/db';
import * as dbSchema from '@repo/db/schema';

const databaseUrl = process.env.DATABASE_URL ?? env.DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET ?? env.BETTER_AUTH_SECRET;
const origin = process.env.ORIGIN ?? env.ORIGIN;

const db = getDb(databaseUrl);

export const auth = betterAuth({
	baseURL: origin,
	secret: authSecret,
	database: drizzleAdapter(db, { provider: 'pg', schema: dbSchema }),
	emailAndPassword: {
		enabled: true
	},
	plugins: [
		organization(),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
