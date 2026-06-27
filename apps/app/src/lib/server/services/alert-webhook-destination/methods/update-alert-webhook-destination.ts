import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { updateAlertWebhookDestinationInputSchema } from "../schema";

const createUpdateAlertWebhookDestination = ({
  db,
  logger,
  encryption,
}: {
  db: DB;
  logger: Logger;
  encryption: Encryption;
}) => async (
  input: z.input<typeof updateAlertWebhookDestinationInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = updateAlertWebhookDestinationInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existing = await db.query.notificationDestination.findFirst({
      where: and(
        eq(notificationDestination.id, validated.data.id),
        eq(notificationDestination.appId, context.appId),
        eq(notificationDestination.kind, "webhook"),
      ),
    });

    if (!existing) {
      return err("Webhook destination not found.");
    }

    await db
      .update(notificationDestination)
      .set({
        name: validated.data.name,
        webhookUrl: validated.data.url,
        webhookHeadersEncrypted: encryption.encrypt(
          JSON.stringify(validated.data.headers),
        ),
        isEnabled: validated.data.isEnabled,
        updatedBy: context.userId,
      })
      .where(eq(notificationDestination.id, existing.id));

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to update webhook destination", error as Error);
    return err("Failed to update webhook destination.");
  }
};

export { createUpdateAlertWebhookDestination };
