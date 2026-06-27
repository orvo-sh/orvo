import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { createAlertWebhookDestinationInputSchema } from "../schema";

const createCreateAlertWebhookDestination = ({
  db,
  logger,
  encryption,
}: {
  db: DB;
  logger: Logger;
  encryption: Encryption;
}) => async (
  input: z.input<typeof createAlertWebhookDestinationInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = createAlertWebhookDestinationInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const result = await db
      .insert(notificationDestination)
      .values({
        id: genId("alds"),
        appId: context.appId,
        name: validated.data.name,
        kind: "webhook",
        webhookUrl: validated.data.url,
        webhookHeadersEncrypted: encryption.encrypt(
          JSON.stringify(validated.data.headers),
        ),
        emailRecipients: [],
        isEnabled: validated.data.isEnabled,
        createdBy: context.userId,
        updatedBy: context.userId,
      })
      .returning({ id: notificationDestination.id });

    return ok({ id: result[0]!.id });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create webhook destination", error as Error);
    return err("Failed to create webhook destination.");
  }
};

export { createCreateAlertWebhookDestination };
