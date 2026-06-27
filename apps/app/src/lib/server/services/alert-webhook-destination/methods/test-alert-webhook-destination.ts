import { recordError } from "$lib/instrumentation";
import type { NotificationDeliveryService } from "$lib/server/services/notification-delivery";
import { and, eq, type DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { testAlertWebhookDestinationInputSchema } from "../schema";

const createTestAlertWebhookDestination = ({
  db,
  logger,
  notificationDeliveryService,
}: {
  db: DB;
  logger: Logger;
  notificationDeliveryService: NotificationDeliveryService;
}) => async (
  input: z.input<typeof testAlertWebhookDestinationInputSchema>,
  context: { appId: string },
) => {
  const validated = testAlertWebhookDestinationInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const destination = await db.query.notificationDestination.findFirst({
      where: and(
        eq(notificationDestination.id, validated.data),
        eq(notificationDestination.appId, context.appId),
        eq(notificationDestination.kind, "webhook"),
      ),
    });

    if (!destination) {
      return err("Webhook destination not found.");
    }

    const attempt = await notificationDeliveryService.createTestDelivery(
      destination,
      context,
    );

    if (!attempt.success) {
      return err(attempt.errorMessage ?? "Webhook test failed.");
    }

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to test webhook destination", error as Error);
    return err("Failed to test webhook destination.");
  }
};

export { createTestAlertWebhookDestination };
