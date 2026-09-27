import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";

import { listSlackChannels } from "../slack-client";

const createListChannels =
  ({
    db,
    encryption,
    logger,
  }: {
    db: DB;
    encryption: Encryption;
    logger: Logger;
  }) =>
  async (context: { appId: string }) => {
    try {
      const destination = await db.query.notificationDestination.findFirst({
        columns: { slackBotTokenEncrypted: true },
        where: and(
          eq(notificationDestination.appId, context.appId),
          eq(notificationDestination.kind, "slack"),
        ),
      });
      if (!destination?.slackBotTokenEncrypted) {
        return err("Slack is not connected.");
      }

      return ok({
        channels: await listSlackChannels(
          encryption.decrypt(destination.slackBotTokenEncrypted),
        ),
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "listChannels: failed to load Slack channels",
        error as Error,
      );
      return err("Failed to load Slack channels.");
    }
  };

export { createListChannels };
