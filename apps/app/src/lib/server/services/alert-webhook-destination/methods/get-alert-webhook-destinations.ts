import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, asc, eq } from "drizzle-orm";

const createGetAlertWebhookDestinations = ({
  db,
  logger,
  encryption,
}: {
  db: DB;
  logger: Logger;
  encryption: Encryption;
}) => async (
  context: { appId: string },
) => {
  try {
    const destinations = await db.query.notificationDestination.findMany({
      where: and(
        eq(notificationDestination.appId, context.appId),
        eq(notificationDestination.kind, "webhook"),
      ),
      orderBy: [asc(notificationDestination.name)],
    });

    return ok({
      destinations: destinations.map((destination) => ({
        id: destination.id,
        appId: destination.appId,
        name: destination.name,
        url: destination.webhookUrl ?? "",
        headers: destination.webhookHeadersEncrypted
          ? JSON.parse(
              encryption.decrypt(destination.webhookHeadersEncrypted),
            )
          : [],
        isEnabled: destination.isEnabled,
        createdBy: destination.createdBy,
        updatedBy: destination.updatedBy,
        createdAt: destination.createdAt,
        updatedAt: destination.updatedAt,
      })),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to get webhook destinations", error as Error);
    return err("Failed to get webhook destinations.");
  }
};

export { createGetAlertWebhookDestinations };
