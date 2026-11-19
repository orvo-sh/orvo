import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { dashboard } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { dashboardIdInputSchema } from "../schema";
const createDeleteDashboard =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof dashboardIdInputSchema>,
    context: { appId: string },
  ) => {
    const validated = dashboardIdInputSchema.safeParse(input);
    if (!validated.success) return err("Invalid dashboard ID.");
    try {
      const rows = await db
        .update(dashboard)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(dashboard.id, validated.data.id),
            eq(dashboard.appId, context.appId),
            isNull(dashboard.deletedAt),
          ),
        )
        .returning({ id: dashboard.id });
      if (!rows.length) return err("Dashboard not found.");
      return ok({ id: rows[0].id });
    } catch (error) {
      recordError(error);
      logger.error(
        "deleteDashboard: failed to delete dashboard",
        error as Error,
      );
      return err("Failed to delete dashboard.");
    }
  };
export { createDeleteDashboard };
