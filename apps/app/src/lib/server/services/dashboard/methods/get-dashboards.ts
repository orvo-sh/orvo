import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { dashboard, dashboardPin } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull, desc, sql } from "drizzle-orm";

const createGetDashboards =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (context: { appId: string; userId: string }) => {
    try {
      const dashboards = await db
        .select({
          id: dashboard.id,
          name: dashboard.name,
          description: dashboard.description,
          panelCount: sql<number>`jsonb_array_length(${dashboard.panels})`,
          updatedAt: dashboard.updatedAt,
          pinned: sql<boolean>`${dashboardPin.userId} is not null`,
        })
        .from(dashboard)
        .leftJoin(
          dashboardPin,
          and(
            eq(dashboardPin.dashboardId, dashboard.id),
            eq(dashboardPin.userId, context.userId),
          ),
        )
        .where(
          and(eq(dashboard.appId, context.appId), isNull(dashboard.deletedAt)),
        )
        .orderBy(desc(dashboard.updatedAt));
      return ok({ dashboards });
    } catch (error) {
      recordError(error);
      logger.error("getDashboards: failed to get dashboards", error as Error);
      return err("Failed to get dashboards.");
    }
  };
export { createGetDashboards };
