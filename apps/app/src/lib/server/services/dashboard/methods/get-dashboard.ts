import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { dashboard } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { dashboardIdInputSchema } from "../schema";
import { dashboardDefinitionSchema } from "$lib/dashboards/schema";
const createGetDashboard =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof dashboardIdInputSchema>,
    context: { appId: string },
  ) => {
    const validated = dashboardIdInputSchema.safeParse(input);
    if (!validated.success) return err("Invalid dashboard ID.");
    try {
      const [row] = await db
        .select()
        .from(dashboard)
        .where(
          and(
            eq(dashboard.id, validated.data.id),
            eq(dashboard.appId, context.appId),
            isNull(dashboard.deletedAt),
          ),
        );
      if (!row) return err("Dashboard not found.");
      return ok({
        dashboard: { ...row, ...dashboardDefinitionSchema.parse(row) },
      });
    } catch (error) {
      recordError(error);
      logger.error("getDashboard: failed to get dashboard", error as Error);
      return err("Failed to get dashboard.");
    }
  };
export { createGetDashboard };
