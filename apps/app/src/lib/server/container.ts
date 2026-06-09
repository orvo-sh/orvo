import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { createAuth, type Auth } from "$lib/server/auth";
import { ConsoleEmail, ResendEmail } from "$lib/server/email";
import { AlertRuleService } from "$lib/server/services/alert-rule.service";
import { AlertWebhookDestinationService } from "$lib/server/services/alert-webhook-destination.service";
import { AppService } from "$lib/server/services/app.service";
import { BillingService } from "$lib/server/services/billing.service";
import { ChatService } from "$lib/server/services/chat.service";
import { DashboardLogViewService } from "$lib/server/services/dashboard-log-view.service";
import { DeploymentService } from "$lib/server/services/deployment.service";
import { IngestionKeyService } from "$lib/server/services/ingestion-key.service";
import { InsightsService } from "$lib/server/services/insights.service";
import { LogFacetsService } from "$lib/server/services/log-facets.service";
import { LogsService } from "$lib/server/services/logs.service";
import { TracesService } from "$lib/server/services/traces.service";
import { UploadService } from "$lib/server/services/upload.service";
import { getClickHouseClient } from "@repo/clickhouse";
import { getDb } from "@repo/db";
import { Encryption } from "@repo/encryption";
import { Logger } from "@repo/logger";
import { Storage } from "@repo/storage";
import Stripe from "stripe";

export type ServerContainer = {
  authService: Auth;
  uploadService: UploadService;
  billingService: Nullable<BillingService>;
  appService: AppService;
  chatService: ChatService;
  alertRuleService: AlertRuleService;
  alertWebhookDestinationService: AlertWebhookDestinationService;
  dashboardLogViewService: DashboardLogViewService;
  deploymentService: DeploymentService;
  ingestionKeyService: IngestionKeyService;
  insightsService: InsightsService;
  logsService: LogsService;
  logFacetsService: LogFacetsService;
  tracesService: TracesService;
};

const db = getDb(process.env.POSTGRES_URL ?? env.POSTGRES_URL);
const clickhouse = getClickHouseClient({
  url: process.env.CLICKHOUSE_URL ?? env.CLICKHOUSE_URL,
});
const resendApiKey = process.env.RESEND_API_KEY ?? env.RESEND_API_KEY;
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL ??
  env.RESEND_FROM_EMAIL ??
  "Orvo <onboarding@resend.dev>";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? env.STRIPE_SECRET_KEY;
const stripeWebhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET;
const stripeStarterPriceId =
  process.env.STRIPE_STARTER_PRICE_ID ?? env.STRIPE_STARTER_PRICE_ID;
const stripeProPriceId =
  process.env.STRIPE_PRO_PRICE_ID ?? env.STRIPE_PRO_PRICE_ID;
const billingSalesEmail =
  process.env.BILLING_SALES_EMAIL ?? env.BILLING_SALES_EMAIL ?? "team@orvo.sh";
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID ?? env.S3_ACCESS_KEY_ID;
const s3SecretAccessKey =
  process.env.S3_SECRET_ACCESS_KEY ?? env.S3_SECRET_ACCESS_KEY;
const s3Endpoint = process.env.S3_ENDPOINT ?? env.S3_ENDPOINT;
const s3Region = process.env.S3_REGION ?? env.S3_REGION;
const s3BucketName = process.env.S3_BUCKET_NAME ?? env.S3_BUCKET_NAME;
const cdnBaseUrl = process.env.CDN_BASE_URL ?? env.CDN_BASE_URL;
const maxUploadSizeBytes = Number(
  process.env.MAX_UPLOAD_SIZE_BYTES ??
    env.MAX_UPLOAD_SIZE_BYTES ??
    10 * 1024 * 1024,
);
const alertsEncryptionSecret =
  process.env.ALERTS_ENCRYPTION_KEY ??
  env.ALERTS_ENCRYPTION_KEY ??
  process.env.BETTER_AUTH_SECRET ??
  env.BETTER_AUTH_SECRET;
if (!alertsEncryptionSecret) {
  throw new Error("Missing ALERTS_ENCRYPTION_KEY");
}
const encryption = new Encryption(alertsEncryptionSecret);
const email =
  dev || !resendApiKey
    ? new ConsoleEmail()
    : new ResendEmail({
        resendApiKey,
        from: resendFromEmail,
      });
const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-05-27.dahlia",
    })
  : null;
const storage =
  s3AccessKeyId && s3SecretAccessKey && s3Endpoint && s3Region && s3BucketName
    ? new Storage({
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
        endpoint: s3Endpoint,
        region: s3Region,
        bucket: s3BucketName,
      })
    : null;

export const createServerContainer = (logger: Logger): ServerContainer => {
  const ingestionKeyService = new IngestionKeyService(db, logger);
  const alertRuleService = new AlertRuleService(db, logger);
  const appService = new AppService(
    db,
    logger,
    ingestionKeyService,
    alertRuleService,
  );
  const billingService = stripeClient
    ? new BillingService(db, logger, email, stripeClient, billingSalesEmail)
    : null;
  const githubClientId = process.env.GITHUB_CLIENT_ID ?? env.GITHUB_CLIENT_ID;
  const githubClientSecret =
    process.env.GITHUB_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET;

  const authService = createAuth(db, email, billingService, {
    secret: (process.env.BETTER_AUTH_SECRET ??
      env.BETTER_AUTH_SECRET) as string,
    baseUrl: (process.env.ORIGIN ?? env.ORIGIN) as string,
    github:
      githubClientId && githubClientSecret
        ? {
            clientId: githubClientId,
            clientSecret: githubClientSecret,
          }
        : undefined,
    stripe:
      stripeClient &&
      stripeWebhookSecret &&
      stripeStarterPriceId &&
      stripeProPriceId
        ? {
            client: stripeClient,
            webhookSecret: stripeWebhookSecret,
            starterPriceId: stripeStarterPriceId,
            proPriceId: stripeProPriceId,
          }
        : undefined,
  });
  const uploadService = new UploadService(logger, storage, {
    cdnBaseUrl,
    maxUploadSizeBytes: Number.isFinite(maxUploadSizeBytes)
      ? maxUploadSizeBytes
      : 10 * 1024 * 1024,
  });
  const logsService = new LogsService(clickhouse, logger);
  const logFacetsService = new LogFacetsService(clickhouse, logger);
  const tracesService = new TracesService(clickhouse, logger);
  const insightsService = new InsightsService(clickhouse, db, logger);

  return {
    authService,
    uploadService,
    billingService,
    appService,
    chatService: new ChatService(db, logger),
    alertRuleService,
    alertWebhookDestinationService: new AlertWebhookDestinationService(
      db,
      logger,
      encryption,
    ),
    dashboardLogViewService: new DashboardLogViewService(db, logger),
    deploymentService: new DeploymentService(db, clickhouse, logger),
    ingestionKeyService,
    insightsService,
    logsService,
    logFacetsService,
    tracesService,
  };
};
