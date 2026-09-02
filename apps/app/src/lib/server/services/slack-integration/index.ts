import { Instrument } from "$lib/instrumentation";
import type { IncidentService } from "$lib/server/services/incident";
import type { NotificationDeliveryService } from "$lib/server/services/notification-delivery";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";

import { createCompleteOauth } from "./methods/complete-oauth";
import { createCreateConnectUrl } from "./methods/create-connect-url";
import { createDisconnectIntegration } from "./methods/disconnect-integration";
import { createGetIntegration } from "./methods/get-integration";
import { createProcessAction } from "./methods/process-action";

@Instrument({ prefix: "slackIntegration" })
class SlackIntegrationService {
  private createConnectUrlMethod: ReturnType<typeof createCreateConnectUrl>;
  private completeOauthMethod: ReturnType<typeof createCompleteOauth>;
  private getIntegrationMethod: ReturnType<typeof createGetIntegration>;
  private disconnectIntegrationMethod: ReturnType<
    typeof createDisconnectIntegration
  >;
  private processActionMethod: ReturnType<typeof createProcessAction>;

  constructor(
    private db: DB,
    logger: Logger,
    encryption: Encryption,
    private notificationDeliveryService: NotificationDeliveryService,
    incidentService: IncidentService,
    config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    },
  ) {
    const childLogger = logger.child("SlackIntegrationService");
    this.createConnectUrlMethod = createCreateConnectUrl({
      db,
      logger: childLogger,
      config,
    });
    this.completeOauthMethod = createCompleteOauth({
      db,
      encryption,
      logger: childLogger,
      config,
    });
    this.getIntegrationMethod = createGetIntegration({
      db,
      logger: childLogger,
    });
    this.disconnectIntegrationMethod = createDisconnectIntegration({
      db,
      logger: childLogger,
    });
    this.processActionMethod = createProcessAction({
      db,
      incidentService,
      logger: childLogger,
    });
  }

  async createConnectUrl(context: {
    appId: string;
    organizationId: string;
    userId: string;
  }) {
    return this.createConnectUrlMethod(context);
  }

  async completeOauth(input: {
    code: string;
    state: string;
    oauthError?: string | null;
  }) {
    return this.completeOauthMethod(input);
  }

  async getIntegration(context: { appId: string }) {
    return this.getIntegrationMethod(context);
  }

  async testIntegration(context: { appId: string }) {
    const destination = await this.db.query.notificationDestination.findFirst({
      where: and(
        eq(notificationDestination.appId, context.appId),
        eq(notificationDestination.kind, "slack"),
      ),
    });
    if (!destination) return err("Slack is not connected.");
    const attempt = await this.notificationDeliveryService.createTestDelivery(
      destination,
      context,
    );
    return attempt.success
      ? ok(undefined)
      : err(attempt.errorMessage ?? "Slack test notification failed.");
  }

  async disconnectIntegration(context: { appId: string }) {
    return this.disconnectIntegrationMethod(context);
  }

  async processAction(input: unknown) {
    return this.processActionMethod(input);
  }
}

export { SlackIntegrationService };
