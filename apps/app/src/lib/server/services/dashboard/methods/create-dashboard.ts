import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { dashboard } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok, genId } from "@repo/utils";
import { z } from "zod";

import { createDashboardInputSchema } from "../schema";
const createCreateDashboard =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof createDashboardInputSchema>,
    context: { appId: string; userId: string },
  ) => {
    const validated = createDashboardInputSchema.safeParse(input);
    if (!validated.success)
      return err(validated.error.issues[0]?.message ?? "Invalid dashboard.");
    try {
      const id = genId("dash");
      await db
        .insert(dashboard)
        .values({
          ...validated.data,
          id,
          appId: context.appId,
          createdBy: context.userId,
        });
      return ok({ id });
    } catch (error) {
      recordError(error);
      logger.error(
        "createDashboard: failed to create dashboard",
        error as Error,
      );
      return err("Failed to create dashboard.");
    }
  };
export { createCreateDashboard };
