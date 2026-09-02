import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import {
  app,
  member,
  notificationDestination,
  slackOauthState,
} from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq, gt } from "drizzle-orm";

import { slackOauthResponseSchema } from "../schema";
import { hashSlackOauthState } from "../shared";

const createCompleteOauth =
  ({
    db,
    encryption,
    logger,
    config,
  }: {
    db: DB;
    encryption: Encryption;
    logger: Logger;
    config: { clientId: string; clientSecret: string; redirectUri: string };
  }) =>
  async (input: {
    code: string;
    state: string;
    oauthError?: string | null;
  }) => {
    if (!config.clientId || !config.clientSecret) {
      return err("Slack is not configured.");
    }

    try {
      const [oauthState] = await db
        .delete(slackOauthState)
        .where(
          and(
            eq(slackOauthState.stateHash, hashSlackOauthState(input.state)),
            gt(slackOauthState.expiresAt, new Date()),
          ),
        )
        .returning();

      if (!oauthState)
        return err("Slack authorization expired. Please try again.");

      const [currentApp, currentMember] = await Promise.all([
        db.query.app.findFirst({
          where: and(
            eq(app.id, oauthState.appId),
            eq(app.organizationId, oauthState.organizationId),
          ),
        }),
        db.query.member.findFirst({
          where: and(
            eq(member.organizationId, oauthState.organizationId),
            eq(member.userId, oauthState.userId),
          ),
        }),
      ]);

      if (!currentApp || !currentMember) {
        return {
          success: false as const,
          error: "You no longer have access to this app.",
          appId: oauthState.appId,
        };
      }

      if (input.oauthError || !input.code) {
        return {
          success: false as const,
          error:
            input.oauthError === "access_denied"
              ? "Slack connection was cancelled."
              : "Slack could not complete the connection.",
          appId: oauthState.appId,
        };
      }

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: input.code,
          redirect_uri: config.redirectUri,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      const parsed = slackOauthResponseSchema.safeParse(body);

      if (!response.ok || !parsed.success) {
        logger.warn("completeOauth: Slack rejected OAuth exchange", {
          httpStatus: response.status,
          slackError:
            body && typeof body === "object" && "error" in body
              ? String(body.error)
              : "invalid_response",
        });
        return {
          success: false as const,
          error: "Slack could not complete the connection.",
          appId: oauthState.appId,
        };
      }

      const existing = await db.query.notificationDestination.findFirst({
        where: and(
          eq(notificationDestination.appId, oauthState.appId),
          eq(notificationDestination.kind, "slack"),
        ),
      });
      const destinationId = existing?.id ?? genId("ntds");
      const values = {
        name: `Slack · ${parsed.data.incoming_webhook.channel}`,
        kind: "slack" as const,
        isEnabled: true,
        webhookUrl: null,
        webhookHeadersEncrypted: null,
        emailRecipients: [],
        slackTeamId: parsed.data.team.id,
        slackTeamName: parsed.data.team.name,
        slackChannelId: parsed.data.incoming_webhook.channel_id,
        slackChannelName: parsed.data.incoming_webhook.channel.replace(
          /^#/,
          "",
        ),
        slackWebhookUrlEncrypted: encryption.encrypt(
          parsed.data.incoming_webhook.url,
        ),
        updatedBy: oauthState.userId,
      };

      if (existing) {
        await db
          .update(notificationDestination)
          .set(values)
          .where(eq(notificationDestination.id, existing.id));
      } else {
        await db.insert(notificationDestination).values({
          id: destinationId,
          appId: oauthState.appId,
          ...values,
          createdBy: oauthState.userId,
        });
      }

      return ok({ appId: oauthState.appId, destinationId });
    } catch (error) {
      recordError(error);
      logger.error(
        "completeOauth: failed to complete Slack OAuth",
        error as Error,
      );
      return err("Failed to connect Slack.");
    }
  };

export { createCompleteOauth };
