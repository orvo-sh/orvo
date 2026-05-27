import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getClickHouseClient } from '@repo/clickhouse';
import { getDb } from '@repo/db';
import { createAuth, type Auth } from '$lib/server/auth';
import { ConsoleEmail, ResendEmail } from '$lib/server/email';
import { IngestionKeyService } from '$lib/server/services/ingestion-key.service';
import { Logger } from '$lib/server/observability/logger';
import { LogFacetsService } from '$lib/server/services/log-facets.service';
import { LogsService } from '$lib/server/services/logs.service';

export type ServerContainer = {
	authService: Auth;
	ingestionKeyService: IngestionKeyService;
	logsService: LogsService;
	logFacetsService: LogFacetsService;
};

const db = getDb(process.env.POSTGRES_URL ?? env.POSTGRES_URL);
const clickhouse = getClickHouseClient({
	url: process.env.CLICKHOUSE_URL ?? env.CLICKHOUSE_URL
});
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

export const createServerContainer = (logger: Logger): ServerContainer => {
	return {
		authService: createAuth({
			db,
			email,
			secret: process.env.BETTER_AUTH_SECRET ?? env.BETTER_AUTH_SECRET,
			baseUrl: process.env.ORIGIN ?? env.ORIGIN,
			githubClientId: process.env.GITHUB_CLIENT_ID ?? env.GITHUB_CLIENT_ID,
			githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET
		}),
		ingestionKeyService: new IngestionKeyService(db, logger),
		logsService: new LogsService(clickhouse, logger),
		logFacetsService: new LogFacetsService(clickhouse, logger)
	};
};
