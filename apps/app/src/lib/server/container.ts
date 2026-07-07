import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "$lib/constants";
import { createAuth } from "$lib/server/auth";
import { AlertRuleService } from "$lib/server/services/alert-rule";
import { AlertWebhookDestinationService } from "$lib/server/services/alert-webhook-destination";
import { AppService } from "$lib/server/services/app";
import { BillingService } from "$lib/server/services/billing";
import { HeartbeatService } from "$lib/server/services/heartbeat";
import { IncidentService } from "$lib/server/services/incident";
import { IngestionKeyService } from "$lib/server/services/ingestion-key";
import { LogsService } from "$lib/server/services/logs";
import { McpOauthGrantService } from "$lib/server/services/mcp-oauth-grant.service";
import { McpService } from "$lib/server/services/mcp";
import { McpTokenService } from "$lib/server/services/mcp-token";
import { MetricsService } from "$lib/server/services/metrics";
import { NotificationDeliveryService } from "$lib/server/services/notification-delivery";
import { NotificationDestinationService } from "$lib/server/services/notification-destination";
import { OnboardingService } from "$lib/server/services/onboarding";
import { TracesService } from "$lib/server/services/traces";
import { UploadService } from "$lib/server/services/upload";
import { getClickHouseClient } from "@repo/clickhouse";
import { getDb } from "@repo/db";
import { Encryption } from "@repo/encryption";
import { Logger } from "@repo/logger";
import { Storage } from "@repo/storage";
import Stripe from "stripe";

import { Email } from "./email";

const db = getDb(env.POSTGRES_URL);
const clickhouse = getClickHouseClient({ url: env.CLICKHOUSE_URL });
const storage =
  env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_ENDPOINT
    ? new Storage({
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET_NAME,
      })
    : null;

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" })
  : null;
const email = new Email({
  resendApiKey: env.RESEND_API_KEY,
  transport: dev ? "console" : "resend",
});
const encryption = new Encryption({ secret: env.ENCRYPTION_SECRET });

const createServerContainer = (logger: Logger) => {
  const ingestionKeyService = new IngestionKeyService(db, logger);
  const notificationDeliveryService = new NotificationDeliveryService(
    db,
    logger,
    encryption,
    email,
  );
  const notificationDestinationService = new NotificationDestinationService(
    db,
    logger,
    encryption,
    notificationDeliveryService,
  );
  const alertRuleService = new AlertRuleService(db, logger);
  const alertWebhookDestinationService = new AlertWebhookDestinationService(
    db,
    logger,
    encryption,
    notificationDeliveryService,
  );
  const logsService = new LogsService(clickhouse, logger);
  const tracesService = new TracesService(clickhouse, logger);
  const incidentService = new IncidentService(db, logger);
  const metricsService = new MetricsService(clickhouse, logger);
  const heartbeatService = new HeartbeatService(
    db,
    clickhouse,
    logger,
    incidentService,
    {
      appBaseUrl: env.ORIGIN,
      ingestBaseUrl: env.INGEST_BASE_URL,
    },
  );
  const appService = new AppService(
    db,
    logger,
    ingestionKeyService,
    alertRuleService,
  );
  const onboardingService = new OnboardingService(
    ingestionKeyService,
    { otlpBaseUrl: env.INGEST_BASE_URL },
    logger,
  );
  const mcpTokenService = new McpTokenService(
    db,
    logger,
    env.ENCRYPTION_SECRET,
  );
  const mcpOauthGrantService = new McpOauthGrantService(db, logger);
  const billingService = stripe
    ? new BillingService(db, logger, email, stripe, {
        starterPriceId: env.STRIPE_STARTER_PRICE_ID,
        proPriceId: env.STRIPE_PRO_PRICE_ID,
        trialDays: 14,
      })
    : null;
  const uploadService = new UploadService(logger, storage, {
    cdnBaseUrl: env.CDN_BASE_URL,
    maxUploadSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
  });

  const authService = createAuth(db, logger, email, billingService, {
    secret: env.BETTER_AUTH_SECRET || env.ENCRYPTION_SECRET,
    baseUrl: env.ORIGIN,
    github:
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          }
        : undefined,
    stripe: stripe
      ? {
          client: stripe,
          webhookSecret: env.STRIPE_WEBHOOK_SECRET,
          starterPriceId: env.STRIPE_STARTER_PRICE_ID,
          proPriceId: env.STRIPE_PRO_PRICE_ID,
        }
      : undefined,
  });
  const mcpService = new McpService(
    logger,
    appService,
    logsService,
    tracesService,
    metricsService,
    incidentService,
    heartbeatService,
  );

  return {
    authService,
    mcpOauthGrantService,
    mcpTokenService,
    uploadService,
    billingService,
    appService,
    alertRuleService,
    alertWebhookDestinationService,
    heartbeatService,
    ingestionKeyService,
    incidentService,
    logsService,
    metricsService,
    notificationDestinationService,
    onboardingService,
    tracesService,
    mcpService,
  };
};

const createWorkerContainer = (logger: Logger) => {
  const notificationDeliveryService = new NotificationDeliveryService(
    db,
    logger,
    encryption,
    email,
  );
  const incidentService = new IncidentService(db, logger);
  const heartbeatService = new HeartbeatService(
    db,
    clickhouse,
    logger,
    incidentService,
    {
      appBaseUrl: env.ORIGIN,
      ingestBaseUrl: env.INGEST_BASE_URL,
    },
  );

  return {
    clickhouse,
    db,
    heartbeatService,
    incidentService,
    notificationDeliveryService,
  };
};

export { createServerContainer, createWorkerContainer };
