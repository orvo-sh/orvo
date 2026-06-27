import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDelivery, notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { and, asc, eq, lte } from "drizzle-orm";

import { deliveryRetryMinutes } from "../shared";

const createProcessDueDeliveries = ({
  db,
  logger,
  sendToDestination,
}: {
  db: DB;
  logger: Logger;
  sendToDestination: (
    destination: typeof notificationDestination.$inferSelect,
    payload: Record<string, unknown>,
    eventType: typeof notificationDelivery.$inferSelect.eventType,
  ) => Promise<{
    success: boolean;
    httpStatus: number | null;
    errorMessage: string | null;
  }>;
}) => async (
  limit = 50,
) => {
  try {
    const dueDeliveries = await db.query.notificationDelivery.findMany({
      where: and(
        eq(notificationDelivery.status, "pending"),
        lte(notificationDelivery.nextAttemptAt, new Date()),
      ),
      orderBy: [asc(notificationDelivery.nextAttemptAt)],
      limit,
    });

    for (const delivery of dueDeliveries) {
      const destination = await db.query.notificationDestination.findFirst({
        where: eq(notificationDestination.id, delivery.destinationId),
      });

      const now = new Date();
      const attemptNumber = delivery.attemptNumber + 1;

      if (!destination || !destination.isEnabled) {
        await db
          .update(notificationDelivery)
          .set({
            status: "failed",
            attemptNumber,
            lastAttemptAt: now,
            errorMessage: destination
              ? "Destination is disabled."
              : "Destination not found.",
          })
          .where(eq(notificationDelivery.id, delivery.id));
        continue;
      }

      const result = await sendToDestination(
        destination,
        delivery.payload,
        delivery.eventType,
      );

      if (result.success) {
        await db
          .update(notificationDelivery)
          .set({
            status: "succeeded",
            attemptNumber,
            lastAttemptAt: now,
            deliveredAt: now,
            httpStatus: result.httpStatus,
            errorMessage: null,
          })
          .where(eq(notificationDelivery.id, delivery.id));
        continue;
      }

      const retryMinutes = deliveryRetryMinutes[attemptNumber - 1] ?? null;

      await db
        .update(notificationDelivery)
        .set({
          status: retryMinutes === null ? "failed" : "pending",
          attemptNumber,
          nextAttemptAt:
            retryMinutes === null
              ? now
              : new Date(now.getTime() + retryMinutes * 60_000),
          lastAttemptAt: now,
          httpStatus: result.httpStatus,
          errorMessage: result.errorMessage,
        })
        .where(eq(notificationDelivery.id, delivery.id));
    }

    return { processed: dueDeliveries.length };
  } catch (error) {
    recordError(error);
    logger.error("Failed to process due notification deliveries", error as Error);
    throw error;
  }
};

export { createProcessDueDeliveries };
