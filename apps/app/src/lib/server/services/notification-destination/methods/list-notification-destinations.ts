import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { asc, eq } from "drizzle-orm";

const createListNotificationDestinations = ({
  db,
  logger,
  decodeHeaders,
}: {
  db: DB;
  logger: Logger;
  decodeHeaders: (
    destination: typeof notificationDestination.$inferSelect,
  ) => Array<{ key: string; value: string }>;
}) => async (
  context: { appId: string },
) => {
  try {
    const destinations = await db.query.notificationDestination.findMany({
      where: eq(notificationDestination.appId, context.appId),
      orderBy: [asc(notificationDestination.name)],
    });

    return ok({
      destinations: destinations.map((destination) => ({
        ...destination,
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
