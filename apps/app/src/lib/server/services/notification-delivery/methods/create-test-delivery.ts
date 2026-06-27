import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { app, notificationDelivery, notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { eq } from "drizzle-orm";

const createCreateTestDelivery = ({
  db,
  logger,
  sendToDestination,
}: {
  db: DB;
  logger: Logger;
  sendToDestination: (
    destination: typeof notificationDestination.$inferSelect,
    payload: Record<string, unknown>,
    eventType: "destination.test",
  ) => Promise<{
    success: boolean;
    httpStatus: number | null;
    errorMessage: string | null;
  }>;
}) => async (
  destination: typeof notificationDestination.$inferSelect,
  context: { appId: string },
) => {
  const currentApp = await db.query.app.findFirst({
    where: eq(app.id, context.appId),
  });
  const payload = {
    type: "destination.test",
    timestamp: new Date().toISOString(),
    appId: context.appId,
    app: {
      id: context.appId,
      name: currentApp?.name ?? "Orvo app",
    },
    destination: {
      id: destination.id,
      name: destination.name,
      kind: destination.kind,
    },
  } satisfies Record<string, unknown>;
  const now = new Date();
  const id = genId("ntdl");

  try {
    const attempt = await sendToDestination(
      destination,
      payload,
      "destination.test",
    );

    await db.insert(notificationDelivery).values({
      id,
      appId: context.appId,
      destinationId: destination.id,
      sourceKind: "heartbeat",
      sourceId: destination.id,
      eventType: "destination.test",
      payload,
      status: attempt.success ? "succeeded" : "failed",
      attemptNumber: 1,
      nextAttemptAt: now,
      lastAttemptAt: now,
      deliveredAt: attempt.success ? now : null,
      httpStatus: attempt.httpStatus,
      errorMessage: attempt.errorMessage,
    });

    return attempt;
  } catch (error) {
    recordError(error);
    logger.error("Failed to create test delivery", error as Error);
    throw error;
  }
};

export { createCreateTestDelivery };
