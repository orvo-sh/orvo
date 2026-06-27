import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { createNotificationDestinationInputSchema } from "../schema";

const createCreateNotificationDestination = ({
  db,
  logger,
  prepareDestinationInput,
}: {
  db: DB;
  logger: Logger;
  prepareDestinationInput: (
    input: z.infer<typeof createNotificationDestinationInputSchema>,
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
  input: z.input<typeof createNotificationDestinationInputSchema>,
  context: { appId: string; organizationId: string; userId: string },
) => {
  const validated = createNotificationDestinationInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const destination = await prepareDestinationInput(
      validated.data,
      context.organizationId,
    );
    if (!destination.success) {
      return destination;
    }

    const id = genId("ntds");

    await db.insert(notificationDestination).values({
      id,
      appId: context.appId,
      name: validated.data.name,
      kind: validated.data.kind,
      isEnabled: validated.data.isEnabled,
      webhookUrl: destination.data.webhookUrl,
      webhookHeadersEncrypted: destination.data.webhookHeadersEncrypted,
      emailRecipients: destination.data.emailRecipients,
      createdBy: context.userId,
      updatedBy: context.userId,
    });

    return ok({ id });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create notification destination", error as Error);
    return err("Failed to create notification destination.");
  }
};

export { createCreateNotificationDestination };
