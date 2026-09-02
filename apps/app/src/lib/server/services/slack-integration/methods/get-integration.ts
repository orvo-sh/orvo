import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";

const createGetIntegration =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (context: { appId: string }) => {
    try {
      const integration = await db.query.notificationDestination.findFirst({
        columns: {
          id: true,
          name: true,
          isEnabled: true,
          slackTeamId: true,
          slackTeamName: true,
          slackChannelId: true,
          slackChannelName: true,
          createdAt: true,
          updatedAt: true,
        },
        where: and(
          eq(notificationDestination.appId, context.appId),
          eq(notificationDestination.kind, "slack"),
        ),
      });

      return ok({ integration: integration ?? null });
    } catch (error) {
      recordError(error);
      logger.error(
        "getIntegration: failed to load Slack integration",
        error as Error,
      );
      return err("Failed to load Slack integration.");
    }
  };

export { createGetIntegration };
