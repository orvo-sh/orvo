import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { dashboard, dashboardPin } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { pinDashboardInputSchema } from "../schema";
const createPinDashboard =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof pinDashboardInputSchema>,
    context: { appId: string; userId: string },
  ) => {
    const validated = pinDashboardInputSchema.safeParse(input);
    if (!validated.success) return err("Invalid dashboard pin.");
    try {
      const [row] = await db
        .select({ id: dashboard.id })
        .from(dashboard)
        .where(
          and(
            eq(dashboard.id, validated.data.id),
            eq(dashboard.appId, context.appId),
            isNull(dashboard.deletedAt),
          ),
        );
      if (!row) return err("Dashboard not found.");
      if (validated.data.pinned)
        await db
          .insert(dashboardPin)
          .values({ dashboardId: row.id, userId: context.userId })
          .onConflictDoNothing();
      else
        await db
          .delete(dashboardPin)
          .where(
            and(
              eq(dashboardPin.dashboardId, row.id),
              eq(dashboardPin.userId, context.userId),
            ),
          );
      return ok({ id: row.id });
    } catch (error) {
      recordError(error);
      logger.error("pinDashboard: failed to pin dashboard", error as Error);
      return err("Failed to update dashboard pin.");
    }
  };
export { createPinDashboard };
