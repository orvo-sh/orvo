import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { getDb } from '@repo/db';
import * as dbSchema from '@repo/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';

const databaseUrl = process.env.POSTGRES_URL ?? env.POSTGRES_URL;
const authSecret = process.env.BETTER_AUTH_SECRET ?? env.BETTER_AUTH_SECRET;
const origin = process.env.ORIGIN ?? env.ORIGIN;
const githubClientId = process.env.GITHUB_CLIENT_ID ?? env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET;

const db = getDb(databaseUrl);

const createAuth = () => {
	return betterAuth({
		baseURL: origin,
		secret: authSecret,
		database: drizzleAdapter(db, { provider: 'pg', schema: dbSchema }),
		emailAndPassword: {
			enabled: true
		},
		socialProviders: githubClientId && githubClientSecret ? {
			github: {
				clientId: githubClientId,
				clientSecret: githubClientSecret
			}
		} : undefined,
		plugins: [
			organization(),
			sveltekitCookies(getRequestEvent)
		]
	})
}

type Auth = ReturnType<typeof createAuth>;
export { createAuth, type Auth };
