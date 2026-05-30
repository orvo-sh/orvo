import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createAuth, type Auth } from '$lib/server/auth';
import { ConsoleEmail, ResendEmail } from '$lib/server/email';
import { Logger } from '$lib/server/observability/logger';
import { IngestionKeyService } from '$lib/server/services/ingestion-key.service';
import { LogFacetsService } from '$lib/server/services/log-facets.service';
import { LogsService } from '$lib/server/services/logs.service';
import { TracesService } from '$lib/server/services/traces.service';
import { getClickHouseClient } from '@repo/clickhouse';
import { getDb } from '@repo/db';

export type ServerContainer = {
	authService: Auth;
	ingestionKeyService: IngestionKeyService;
	logsService: LogsService;
	logFacetsService: LogFacetsService;
	tracesService: TracesService;
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
	const ingestionKeyService = new IngestionKeyService(db, logger);

	return {
		authService: createAuth({
			db,
			email,
			secret: process.env.BETTER_AUTH_SECRET ?? env.BETTER_AUTH_SECRET,
			baseUrl: process.env.ORIGIN ?? env.ORIGIN,
			githubClientId: process.env.GITHUB_CLIENT_ID ?? env.GITHUB_CLIENT_ID,
			githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET,
			onOrganizationCreated: async ({ organizationId, userId }) => {
				const results = await Promise.all([
					ingestionKeyService.createIngestionKey({ kind: 'public' }, { organizationId, userId }),
					ingestionKeyService.createIngestionKey({ kind: 'private' }, { organizationId, userId })
				]);

				for (const result of results) {
					if (result.success === false) {
						throw new Error(result.error);
					}
				}
			}
		}),
		ingestionKeyService,
		logsService: new LogsService(clickhouse, logger),
		logFacetsService: new LogFacetsService(clickhouse, logger),
		tracesService: new TracesService(clickhouse, logger)
	};
};
