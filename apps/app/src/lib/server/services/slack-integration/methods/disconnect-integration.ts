import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";

const createDisconnectIntegration =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (context: { appId: string }) => {
    try {
      const [deleted] = await db
        .delete(notificationDestination)
        .where(
          and(
            eq(notificationDestination.appId, context.appId),
            eq(notificationDestination.kind, "slack"),
          ),
        )
        .returning({ id: notificationDestination.id });

      if (!deleted) return err("Slack is not connected.");
      return ok({ id: deleted.id });
    } catch (error) {
      recordError(error);
      logger.error(
        "disconnectIntegration: failed to disconnect Slack",
        error as Error,
      );
      return err("Failed to disconnect Slack.");
    }
  };

export { createDisconnectIntegration };
