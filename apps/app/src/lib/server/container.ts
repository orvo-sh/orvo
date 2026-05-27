import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getDb } from '@repo/db';
import { createAuth, type Auth } from '$lib/server/auth';
import { ConsoleEmail, ResendEmail } from '$lib/server/email';

export type ServerContainer = {
	authService: Auth;
};

export const createServerContainer = (): ServerContainer => {
	const db = getDb(process.env.POSTGRES_URL ?? env.POSTGRES_URL);
	const resendApiKey = process.env.RESEND_API_KEY ?? env.RESEND_API_KEY;
	const resendFromEmail =
		process.env.RESEND_FROM_EMAIL ?? env.RESEND_FROM_EMAIL ?? 'Orvo <onboarding@resend.dev>';
	const email =
		dev || !resendApiKey
			? new ConsoleEmail()
			: new ResendEmail({
					resendApiKey,
					from: resendFromEmail
				});

	return {
		authService: createAuth({
			db,
			email,
			secret: process.env.BETTER_AUTH_SECRET ?? env.BETTER_AUTH_SECRET,
			baseUrl: process.env.ORIGIN ?? env.ORIGIN,
			githubClientId: process.env.GITHUB_CLIENT_ID ?? env.GITHUB_CLIENT_ID,
			githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET
		})
	};
};
