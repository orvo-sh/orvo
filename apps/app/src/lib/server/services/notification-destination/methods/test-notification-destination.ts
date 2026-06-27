import { recordError } from "$lib/instrumentation";
import type { NotificationDeliveryService } from "$lib/server/services/notification-delivery";
import { and, eq, type DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { testNotificationDestinationInputSchema } from "../schema";

const createTestNotificationDestination = ({
  db,
  logger,
  notificationDeliveryService,
}: {
  db: DB;
  logger: Logger;
  notificationDeliveryService: NotificationDeliveryService;
}) => async (
  input: z.input<typeof testNotificationDestinationInputSchema>,
  context: { appId: string },
) => {
  const validated = testNotificationDestinationInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const destination = await db.query.notificationDestination.findFirst({
      where: and(
        eq(notificationDestination.id, validated.data),
        eq(notificationDestination.appId, context.appId),
      ),
    });

    if (!destination) {
      return err("Notification destination not found.");
    }

    const attempt = await notificationDeliveryService.createTestDelivery(
      destination,
      context,
    );

    if (!attempt.success) {
      return err(attempt.errorMessage ?? "Test delivery failed.");
    }

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to test notification destination", error as Error);
    return err("Failed to test notification destination.");
  }
};

export { createTestNotificationDestination };
