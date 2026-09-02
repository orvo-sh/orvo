import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { asc, eq } from "drizzle-orm";

const createListNotificationDestinations =
  ({
    db,
    logger,
    decodeHeaders,
  }: {
    db: DB;
    logger: Logger;
    decodeHeaders: (
      destination: typeof notificationDestination.$inferSelect,
    ) => Array<{ key: string; value: string }>;
  }) =>
  async (context: { appId: string }) => {
    try {
      const destinations = await db.query.notificationDestination.findMany({
        where: eq(notificationDestination.appId, context.appId),
        orderBy: [asc(notificationDestination.name)],
      });

      return ok({
        destinations: destinations.map((destination) => ({
          id: destination.id,
          appId: destination.appId,
          name: destination.name,
          kind: destination.kind,
          isEnabled: destination.isEnabled,
          webhookUrl: destination.webhookUrl,
          emailRecipients: destination.emailRecipients,
          slackTeamId: destination.slackTeamId,
          slackTeamName: destination.slackTeamName,
          slackChannelId: destination.slackChannelId,
          slackChannelName: destination.slackChannelName,
          createdBy: destination.createdBy,
          updatedBy: destination.updatedBy,
          createdAt: destination.createdAt,
          updatedAt: destination.updatedAt,
          headers: decodeHeaders(destination),
        })),
      });
    } catch (error) {
      recordError(error);
      logger.error("Failed to load notification destinations", error as Error);
      return err("Failed to load notification destinations.");
    }
  };

export { createListNotificationDestinations };
