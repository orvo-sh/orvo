import { randomBytes } from "node:crypto";
import type { DB } from "@repo/db";
import { slackOauthState } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { lt } from "drizzle-orm";
import { recordError } from "$lib/instrumentation";

import { hashSlackOauthState } from "../shared";

const createCreateConnectUrl =
  ({
    db,
    logger,
    config,
  }: {
    db: DB;
    logger: Logger;
    config: { clientId: string; redirectUri: string };
  }) =>
  async (context: {
    appId: string;
    organizationId: string;
    userId: string;
  }) => {
    if (!config.clientId) return err("Slack is not configured.");

    try {
      const state = randomBytes(32).toString("base64url");

      await db.transaction(async (tx) => {
        await tx
          .delete(slackOauthState)
          .where(lt(slackOauthState.expiresAt, new Date()));
        await tx.insert(slackOauthState).values({
          stateHash: hashSlackOauthState(state),
          appId: context.appId,
          organizationId: context.organizationId,
          userId: context.userId,
          expiresAt: new Date(Date.now() + 10 * 60_000),
        });
      });

      const url = new URL("https://slack.com/oauth/v2/authorize");
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("scope", "incoming-webhook");
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("state", state);

      return ok({ url: url.toString() });
    } catch (error) {
      recordError(error);
      logger.error(
        "createConnectUrl: failed to start Slack OAuth",
        error as Error,
      );
      return err("Failed to connect Slack.");
    }
  };

export { createCreateConnectUrl };
