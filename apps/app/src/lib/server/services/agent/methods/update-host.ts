import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { agentInstallation } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { updateHostInputSchema } from "../schema";

const createUpdateHost =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof updateHostInputSchema>,
    context: { appId: string },
  ) => {
    const validated = updateHostInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const [host] = await db
        .update(agentInstallation)
        .set({
          displayName: validated.data.displayName,
          environment: validated.data.environment,
        })
        .where(
          and(
            eq(agentInstallation.id, validated.data.id),
            eq(agentInstallation.appId, context.appId),
            isNull(agentInstallation.revokedAt),
          ),
        )
        .returning({ id: agentInstallation.id });

      if (!host) {
        return err("Host not found.");
      }

      return ok({ id: host.id });
    } catch (error) {
      recordError(error);
      logger.error("updateHost: failed to update host", error as Error);
      return err("Failed to update host.");
    }
  };

export { createUpdateHost };
