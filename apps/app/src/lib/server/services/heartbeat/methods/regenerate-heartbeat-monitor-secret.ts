import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { heartbeatMonitor } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { regenerateHeartbeatMonitorSecretInputSchema } from "../schema";
import { buildHeartbeatUrl } from "../shared";

const createRegenerateHeartbeatMonitorSecret = ({
  db,
  logger,
  config,
}: {
  db: DB;
  logger: Logger;
  config: { ingestBaseUrl: string };
}) => async (
  input: z.input<typeof regenerateHeartbeatMonitorSecretInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated =
    regenerateHeartbeatMonitorSecretInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const existing = await db.query.heartbeatMonitor.findFirst({
      where: and(
        eq(heartbeatMonitor.id, validated.data),
        eq(heartbeatMonitor.appId, context.appId),
      ),
    });

    if (!existing) {
      return err("Heartbeat monitor not found.");
    }

    const token = genId("hbt");

    await db
      .update(heartbeatMonitor)
      .set({
        token,
        updatedBy: context.userId,
      })
      .where(eq(heartbeatMonitor.id, existing.id));

    return ok({
      secretUrl: buildHeartbeatUrl(config.ingestBaseUrl, token),
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to regenerate heartbeat secret", error as Error);
    return err("Failed to regenerate heartbeat monitor secret.");
  }
};

export { createRegenerateHeartbeatMonitorSecret };
