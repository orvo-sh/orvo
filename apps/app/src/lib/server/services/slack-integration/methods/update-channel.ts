import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { updateSlackChannelInputSchema } from "../schema";
import { listSlackChannels } from "../slack-client";

const createUpdateChannel =
  ({
    db,
    encryption,
    logger,
  }: {
    db: DB;
    encryption: Encryption;
    logger: Logger;
  }) =>
  async (
    input: z.input<typeof updateSlackChannelInputSchema>,
    context: { appId: string; userId: string },
  ) => {
    const parsed = updateSlackChannelInputSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.message);

    try {
      const destination = await db.query.notificationDestination.findFirst({
        where: and(
          eq(notificationDestination.appId, context.appId),
          eq(notificationDestination.kind, "slack"),
        ),
      });
      if (!destination?.slackBotTokenEncrypted) {
        return err("Slack is not connected.");
      }

      const channel = (
        await listSlackChannels(
          encryption.decrypt(destination.slackBotTokenEncrypted),
        )
      ).find(({ id }) => id === parsed.data.channelId);
      if (!channel) {
        return err("Invite Orvo to that channel before selecting it.");
      }

      await db
        .update(notificationDestination)
        .set({
          name: `Slack · #${channel.name}`,
          slackChannelId: channel.id,
          slackChannelName: channel.name,
          updatedBy: context.userId,
        })
        .where(eq(notificationDestination.id, destination.id));

      return ok({ id: destination.id });
    } catch (error) {
      recordError(error);
      logger.error(
        "updateChannel: failed to update Slack notification channel",
        error as Error,
      );
      return err("Failed to update Slack notification channel.");
    }
  };

export { createUpdateChannel };
