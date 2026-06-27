import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { member, notificationDestination } from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  createNotificationDestinationInputSchema,
  updateNotificationDestinationInputSchema,
} from "./schema";

const createGetDefaultEmailRecipients = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  context: { organizationId: string },
) => {
  try {
    const members = await db.query.member.findMany({
      where: and(
        eq(member.organizationId, context.organizationId),
        inArray(member.role, ["owner"]),
      ),
      with: {
        user: true,
      },
    });

    return ok({
      recipients: [
        ...new Set(
          members
            .map((item) =>
              item.user?.emailVerified ? item.user.email.toLowerCase() : null,
            )
            .filter((email): email is string => Boolean(email)),
        ),
      ],
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load default email recipients", error as Error);
    return err("Failed to load default email recipients.");
  }
};

const createPrepareDestinationInput = ({
  encryption,
  getDefaultEmailRecipients,
}: {
  encryption: Encryption;
  getDefaultEmailRecipients: ReturnType<typeof createGetDefaultEmailRecipients>;
}) => async (
  input:
    | z.infer<typeof createNotificationDestinationInputSchema>
    | z.infer<typeof updateNotificationDestinationInputSchema>,
  organizationId: string,
) => {
  if (input.kind === "webhook") {
    return ok({
      webhookUrl: input.url,
      webhookHeadersEncrypted: encryption.encrypt(JSON.stringify(input.headers)),
      emailRecipients: [],
    });
  }

  const recipients =
    input.recipients.length > 0
      ? input.recipients
      : await (async () => {
          const defaultRecipients = await getDefaultEmailRecipients({
            organizationId,
          });
          return defaultRecipients.success
            ? defaultRecipients.data.recipients
            : [];
        })();

  if (recipients.length === 0) {
    return err("Add at least one email recipient.");
  }

  return ok({
    webhookUrl: null,
    webhookHeadersEncrypted: null,
    emailRecipients: recipients,
  });
};

const decodeDestinationHeaders = ({
  encryption,
}: {
  encryption: Encryption;
}) => (
  destination: typeof notificationDestination.$inferSelect,
) =>
  destination.webhookHeadersEncrypted
    ? (JSON.parse(
        encryption.decrypt(destination.webhookHeadersEncrypted),
      ) as Array<{ key: string; value: string }>)
    : [];

export {
  createGetDefaultEmailRecipients,
  createPrepareDestinationInput,
  decodeDestinationHeaders,
};
