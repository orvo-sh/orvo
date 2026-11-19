import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { dashboard } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { updateDashboardInputSchema } from "../schema";
const createUpdateDashboard =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof updateDashboardInputSchema>,
    context: { appId: string },
  ) => {
    const validated = updateDashboardInputSchema.safeParse(input);
    if (!validated.success)
      return err(validated.error.issues[0]?.message ?? "Invalid dashboard.");
    try {
      const { id, revision, ...definition } = validated.data;
      const rows = await db
        .update(dashboard)
        .set({ ...definition, revision: revision + 1, updatedAt: new Date() })
        .where(
          and(
            eq(dashboard.id, id),
            eq(dashboard.appId, context.appId),
            eq(dashboard.revision, revision),
            isNull(dashboard.deletedAt),
          ),
        )
        .returning({ id: dashboard.id });
      if (!rows.length)
        return err(
          "This dashboard changed or is no longer available. Reload before saving again.",
        );
      return ok({ id });
    } catch (error) {
      recordError(error);
      logger.error(
        "updateDashboard: failed to update dashboard",
        error as Error,
      );
      return err("Failed to save dashboard.");
    }
  };
export { createUpdateDashboard };
