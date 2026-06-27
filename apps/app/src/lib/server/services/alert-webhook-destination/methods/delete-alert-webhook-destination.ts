import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { deleteAlertWebhookDestinationInputSchema } from "../schema";

const createDeleteAlertWebhookDestination = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof deleteAlertWebhookDestinationInputSchema>,
  context: { appId: string },
) => {
  const validated = deleteAlertWebhookDestinationInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    await db
      .delete(notificationDestination)
      .where(
        and(
          eq(notificationDestination.id, validated.data),
          eq(notificationDestination.appId, context.appId),
          eq(notificationDestination.kind, "webhook"),
        ),
      );

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to delete webhook destination", error as Error);
    return err("Failed to delete webhook destination.");
  }
};

export { createDeleteAlertWebhookDestination };
