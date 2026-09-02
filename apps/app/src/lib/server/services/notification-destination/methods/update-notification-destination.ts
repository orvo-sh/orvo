import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { updateNotificationDestinationInputSchema } from "../schema";

const createUpdateNotificationDestination = ({
  db,
  logger,
  prepareDestinationInput,
}: {
  db: DB;
  logger: Logger;
  prepareDestinationInput: (
    input: Exclude<
      z.infer<typeof updateNotificationDestinationInputSchema>,
      { kind: "slack" }
    >,
    organizationId: string,
  ) => Promise<
    | {
        success: true;
        data: {
          webhookUrl: string | null;
          webhookHeadersEncrypted: string | null;
          emailRecipients: string[];
        };
      }
    | { success: false; error: string }
  >;
}) => async (
  input: z.input<typeof updateNotificationDestinationInputSchema>,
  context: { appId: string; organizationId: string; userId: string },
) => {
  const validated = updateNotificationDestinationInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existing = await db.query.notificationDestination.findFirst({
      where: and(
        eq(notificationDestination.id, validated.data.id),
        eq(notificationDestination.appId, context.appId),
      ),
    });

    if (!existing) {
      return err("Notification destination not found.");
    }

    if (existing.kind === "slack" || validated.data.kind === "slack") {
      if (existing.kind !== "slack" || validated.data.kind !== "slack") {
        return err("The notification destination type cannot be changed.");
      }

      await db
        .update(notificationDestination)
        .set({
          name: validated.data.name,
          isEnabled: validated.data.isEnabled,
          updatedBy: context.userId,
        })
        .where(eq(notificationDestination.id, existing.id));

      return ok(undefined);
    }

    const destination = await prepareDestinationInput(
      validated.data,
      context.organizationId,
    );
    if (!destination.success) {
      return destination;
    }

    await db
      .update(notificationDestination)
      .set({
        name: validated.data.name,
        kind: validated.data.kind,
        isEnabled: validated.data.isEnabled,
        webhookUrl: destination.data.webhookUrl,
        webhookHeadersEncrypted: destination.data.webhookHeadersEncrypted,
        emailRecipients: destination.data.emailRecipients,
        updatedBy: context.userId,
      })
      .where(eq(notificationDestination.id, existing.id));

    return ok(undefined);
  } catch (error) {
    recordError(error);
    logger.error("Failed to update notification destination", error as Error);
    return err("Failed to update notification destination.");
  }
};

export { createUpdateNotificationDestination };
