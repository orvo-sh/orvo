import { env } from "$env/dynamic/private";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "$lib/constants";
import { createAuth, type Auth } from "$lib/server/auth";
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
import { MetricsService } from "$lib/server/services/metrics.service";
import { TracesService } from "$lib/server/services/traces.service";
import { UploadService } from "$lib/server/services/upload.service";
import { AI } from "@repo/ai";
import { getClickHouseClient } from "@repo/clickhouse";
import { getDb } from "@repo/db";
import { Encryption } from "@repo/encryption";
import { Logger } from "@repo/logger";
import { Storage } from "@repo/storage";
import Stripe from "stripe";
import { Email } from "./email";

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
  metricsService: MetricsService;
  tracesService: TracesService;
};

const db = getDb(env.POSTGRES_URL);
const clickhouse = getClickHouseClient({ url: env.CLICKHOUSE_URL });
const storage =
  env.SELF_HOSTED == "false"
    ? new Storage({
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET_NAME,
      })
    : null;

const stripe =
  env.SELF_HOSTED == "false"
    ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" })
    : null;
const email =
  env.SELF_HOSTED == "false"
    ? new Email({ resendApiKey: env.RESEND_API_KEY })
    : null;
const ai =
  env.SELF_HOSTED == "false"
    ? new AI({ geminiApiKey: env.GEMINI_API_KEY })
    : null;
const encryption = new Encryption({ secret: env.ENCRYPTION_SECRET });

const stripeWebhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET;
const stripeStarterPriceId =
  process.env.STRIPE_STARTER_PRICE_ID ?? env.STRIPE_STARTER_PRICE_ID;
const stripeProPriceId =
  process.env.STRIPE_PRO_PRICE_ID ?? env.STRIPE_PRO_PRICE_ID;

const cdnBaseUrl = process.env.CDN_BASE_URL ?? env.CDN_BASE_URL;

const maxUploadSizeBytes = Number(
  process.env.MAX_UPLOAD_SIZE_BYTES ??
    env.MAX_UPLOAD_SIZE_BYTES ??
    10 * 1024 * 1024,
);
const alertsEncryptionSecret =
  process.env.ALERTS_ENCRYPTION_KEY ??
  env.ALERTS_ENCRYPTION_KEY ??
  process.env.ENCRYPTION_SECRET ??
  env.ENCRYPTION_SECRET;
if (!alertsEncryptionSecret) {
  throw new Error("Missing ALERTS_ENCRYPTION_KEY");
}

export const createServerContainer = (logger: Logger): ServerContainer => {
  const ingestionKeyService = new IngestionKeyService(db, logger);
  const alertRuleService = new AlertRuleService(db, logger);
  const alertWebhookDestinationService = new AlertWebhookDestinationService(
    db,
    logger,
    encryption,
  );
  const logsService = new LogsService(clickhouse, logger);
  const logFacetsService = new LogFacetsService(clickhouse, logger);
  const dashboardLogViewService = new DashboardLogViewService(db, logger);
  const tracesService = new TracesService(clickhouse, logger);
  const insightsService = new InsightsService(clickhouse, db, logger);
  const metricsService = new MetricsService(clickhouse, logger);
  const deploymentService = new DeploymentService(db, clickhouse, logger);
  const appService = new AppService(
    db,
    logger,
    ingestionKeyService,
    alertRuleService,
  );
  const billingService =
    env.SELF_HOSTED == "false"
      ? new BillingService(db, logger, email!, stripe!)
      : null;
  const uploadService = new UploadService(logger, storage, {
    cdnBaseUrl: env.CDN_BASE_URL,
    maxUploadSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
  });
  const chatService = new ChatService(
    db,
    logger,
    ai,
    appService,
    logsService,
    tracesService,
    alertRuleService,
    insightsService,
  );
  const authService = createAuth(db, email, billingService, {
    secret: env.ENCRYPTION_SECRET,
    baseUrl: env.ORIGIN,
    github:
      env.SELF_HOSTED == "false"
        ? {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          }
        : undefined,
    stripe:
      env.SELF_HOSTED == "false"
        ? {
            client: stripe!,
            webhookSecret: env.STRIPE_WEBHOOK_SECRET,
            starterPriceId: env.STRIPE_STARTER_PRICE_ID,
            proPriceId: env.STRIPE_PRO_PRICE_ID,
          }
        : undefined,
  });

  return {
    authService,
    uploadService,
    billingService,
    appService,
    chatService,
    alertRuleService,
    alertWebhookDestinationService,
    dashboardLogViewService,
    deploymentService,
    ingestionKeyService,
    insightsService,
    logsService,
    logFacetsService,
    metricsService,
    tracesService,
  };
};
