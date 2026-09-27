import { Instrument } from "$lib/instrumentation";
import type { IncidentService } from "$lib/server/services/incident";
import type { ChatService } from "$lib/server/services/chat";
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
import { createIngestEvent } from "./methods/ingest-event";
import { createCompleteLink, createCreateLinkUrl } from "./methods/link-user";
import {
  createProcessScoutRun,
  wrapProcessScoutRun,
} from "./methods/process-scout-run";

@Instrument({ prefix: "slackIntegration" })
class SlackIntegrationService {
  private createConnectUrlMethod: ReturnType<typeof createCreateConnectUrl>;
  private completeOauthMethod: ReturnType<typeof createCompleteOauth>;
  private getIntegrationMethod: ReturnType<typeof createGetIntegration>;
  private disconnectIntegrationMethod: ReturnType<
    typeof createDisconnectIntegration
  >;
  private processActionMethod: ReturnType<typeof createProcessAction>;
  private ingestEventMethod: ReturnType<typeof createIngestEvent>;
  private createLinkUrlMethod: ReturnType<typeof createCreateLinkUrl>;
  private completeLinkMethod: ReturnType<typeof createCompleteLink>;
  private processScoutRunMethod: ReturnType<typeof createProcessScoutRun>;

  constructor(
    private db: DB,
    logger: Logger,
    encryption: Encryption,
    private notificationDeliveryService: NotificationDeliveryService,
    incidentService: IncidentService,
    chatService: ChatService,
    config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      origin: string;
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
    this.ingestEventMethod = createIngestEvent({ db, logger: childLogger });
    this.createLinkUrlMethod = createCreateLinkUrl({
      db,
      logger: childLogger,
      origin: config.origin,
    });
    this.completeLinkMethod = createCompleteLink({ db, logger: childLogger });
    this.processScoutRunMethod = wrapProcessScoutRun(
      createProcessScoutRun({
        db,
        encryption,
        chatService,
        origin: config.origin,
        createLinkUrl: this.createLinkUrlMethod,
      }),
      childLogger,
    );
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

  async ingestEvent(input: unknown) {
    return this.ingestEventMethod(input);
  }

  async completeLink(input: { token: string }, context: { userId: string }) {
    return this.completeLinkMethod(input, context);
  }

  async processScoutRun(job: Parameters<typeof this.processScoutRunMethod>[0]) {
    return this.processScoutRunMethod(job);
  }
}

export { SlackIntegrationService };
