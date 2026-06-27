import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { deleteNotificationDestinationInputSchema } from "../schema";

const createDeleteNotificationDestination = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof deleteNotificationDestinationInputSchema>,
  context: { appId: string },
) => {
  const validated = deleteNotificationDestinationInputSchema.safeParse(input);
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
        ),
      );

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to delete notification destination", error as Error);
    return err("Failed to delete notification destination.");
  }
};

export { createDeleteNotificationDestination };
