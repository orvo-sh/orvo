import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { alertRule } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { and, eq } from "drizzle-orm";
import { err, ok } from "@repo/utils";
import { getAlertRuleInputSchema } from "../schema";

const createTouchAlertRuleDraft =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (id: string, context: { appId: string; userId: string }) => {
    const validated = getAlertRuleInputSchema.safeParse(id);
    if (!validated.success) return err(validated.error.message);
    try {
      await db
        .update(alertRule)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(alertRule.id, validated.data),
            eq(alertRule.appId, context.appId),
            eq(alertRule.createdBy, context.userId),
            eq(alertRule.isDraft, true),
          ),
        );
      return ok(undefined);
    } catch (error) {
      recordError(error);
      logger.error(
        "touchAlertRuleDraft: failed to record draft activity",
        error as Error,
      );
      return err("Failed to record draft activity.");
    }
  };

export { createTouchAlertRuleDraft };
