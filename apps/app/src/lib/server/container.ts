import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createAuth, type Auth } from '$lib/server/auth';
import { ConsoleEmail, ResendEmail } from '$lib/server/email';
import { AppService } from '$lib/server/services/app.service';
import { AlertRuleService } from '$lib/server/services/alert-rule.service';
import { AlertWebhookDestinationService } from '$lib/server/services/alert-webhook-destination.service';
import { BillingService } from '$lib/server/services/billing.service';
import { DashboardLogViewService } from '$lib/server/services/dashboard-log-view.service';
import { IngestionKeyService } from '$lib/server/services/ingestion-key.service';
import { LogFacetsService } from '$lib/server/services/log-facets.service';
import { LogsService } from '$lib/server/services/logs.service';
import { TracesService } from '$lib/server/services/traces.service';
import { getClickHouseClient } from '@repo/clickhouse';
import { getDb } from '@repo/db';
import { Encryption } from '@repo/encryption';
import { Logger } from '@repo/logger';
import Stripe from 'stripe';

export type ServerContainer = {
	authService: Auth;
	billingService: BillingService;
	appService: AppService;
	alertRuleService: AlertRuleService;
	alertWebhookDestinationService: AlertWebhookDestinationService;
	dashboardLogViewService: DashboardLogViewService;
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
const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET;
const stripeStarterPriceId = process.env.STRIPE_STARTER_PRICE_ID ?? env.STRIPE_STARTER_PRICE_ID;
const stripeProPriceId = process.env.STRIPE_PRO_PRICE_ID ?? env.STRIPE_PRO_PRICE_ID;
const billingSalesEmail = process.env.BILLING_SALES_EMAIL ?? env.BILLING_SALES_EMAIL ?? 'team@orvo.sh';
const alertsEncryptionSecret =
	process.env.ALERTS_ENCRYPTION_KEY ??
	env.ALERTS_ENCRYPTION_KEY ??
	process.env.BETTER_AUTH_SECRET ??
	env.BETTER_AUTH_SECRET;
if (!alertsEncryptionSecret) {
	throw new Error('Missing ALERTS_ENCRYPTION_KEY');
}
const encryption = new Encryption(alertsEncryptionSecret);
const email =
	dev || !resendApiKey
		? new ConsoleEmail()
		: new ResendEmail({
			resendApiKey,
			from: resendFromEmail
		});
const stripeClient = stripeSecretKey
	? new Stripe(stripeSecretKey, {
			apiVersion: '2026-05-27.dahlia'
		})
	: null;

export const createServerContainer = (logger: Logger): ServerContainer => {
	const ingestionKeyService = new IngestionKeyService(db, logger);
	const alertRuleService = new AlertRuleService(db, logger);
	const appService = new AppService(db, logger, ingestionKeyService, alertRuleService);
	const billingService = new BillingService(db, logger, stripeClient, billingSalesEmail);
	const authService = createAuth({
		db,
		email,
		secret: process.env.BETTER_AUTH_SECRET ?? env.BETTER_AUTH_SECRET,
		baseUrl: process.env.ORIGIN ?? env.ORIGIN,
		githubClientId: process.env.GITHUB_CLIENT_ID ?? env.GITHUB_CLIENT_ID,
		githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET,
		onOrganizationCreated: async ({ organizationId, userId }) => {
			await billingService.handleOrganizationCreated({ organizationId, userId });
		},
		onSubscriptionChanged: async ({ organizationId, plan, status }) => {
			await billingService.syncEntitlementsForOrganization({ organizationId, plan, status });
		},
		onBillingNotification: async ({ organizationId, kind, payload }) => {
			await billingService.queueNotification({ kind, payload }, { organizationId });
		},
		stripe:
			stripeClient && stripeWebhookSecret && stripeStarterPriceId && stripeProPriceId
				? {
						client: stripeClient,
						webhookSecret: stripeWebhookSecret,
						starterPriceId: stripeStarterPriceId,
						proPriceId: stripeProPriceId
					}
				: undefined
	});

	return {
		authService,
		billingService,
		appService,
		alertRuleService,
		alertWebhookDestinationService: new AlertWebhookDestinationService(db, logger, encryption),
		dashboardLogViewService: new DashboardLogViewService(db, logger),
		ingestionKeyService,
		logsService: new LogsService(clickhouse, logger),
		logFacetsService: new LogFacetsService(clickhouse, logger),
		tracesService: new TracesService(clickhouse, logger)
	};
};
