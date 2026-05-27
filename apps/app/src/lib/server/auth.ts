import { getRequestEvent } from '$app/server';
import { getDb } from '@repo/db';
import * as dbSchema from '@repo/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, organization } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import type { IEmail } from './email';

type DB = ReturnType<typeof getDb>;

const createAuth = (config: {
	db: DB;
	email: IEmail;
	secret: string;
	baseUrl: string;
	githubClientId?: string;
	githubClientSecret?: string;
}) => {
	return betterAuth({
		baseURL: config.baseUrl,
		secret: config.secret,
		database: drizzleAdapter(config.db, { provider: 'pg', schema: dbSchema }),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true
		},
		socialProviders:
			config.githubClientId && config.githubClientSecret
				? {
						github: {
							clientId: config.githubClientId,
							clientSecret: config.githubClientSecret
						}
					}
				: undefined,
		plugins: [
			emailOTP({
				overrideDefaultEmailVerification: true,
				sendVerificationOTP: async ({ email, otp, type }) => {
					if (type !== 'email-verification') {
						return;
					}

					await config.email.sendEmail({
						to: email,
						subject: 'Verify your email',
						template: 'otp',
						props: {
							code: otp,
							purpose: 'sign-up'
						}
					});
				}
			}),
			organization(),
			sveltekitCookies(getRequestEvent)
		]
	});
};

type Auth = ReturnType<typeof createAuth>;
export { createAuth, type Auth };
