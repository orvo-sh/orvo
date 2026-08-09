import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { agentInstallation, ingestionKey } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { deleteHostInputSchema } from "../schema";

const createDeleteHost =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof deleteHostInputSchema>,
    context: { appId: string },
  ) => {
    const validated = deleteHostInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const host = await db.transaction(async (tx) => {
        const [installation] = await tx
          .update(agentInstallation)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(agentInstallation.id, validated.data),
              eq(agentInstallation.appId, context.appId),
              isNull(agentInstallation.revokedAt),
            ),
          )
          .returning({
            id: agentInstallation.id,
            ingestionKeyId: agentInstallation.ingestionKeyId,
          });

        if (!installation) {
          return null;
        }

        await tx
          .update(ingestionKey)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(ingestionKey.id, installation.ingestionKeyId),
              eq(ingestionKey.appId, context.appId),
              isNull(ingestionKey.revokedAt),
            ),
          );

        return installation;
      });

      if (!host) {
        return err("Host not found.");
      }

      return ok({ id: host.id });
    } catch (error) {
      recordError(error);
      logger.error("deleteHost: failed to delete host", error as Error);
      return err("Failed to delete host.");
    }
  };

export { createDeleteHost };
