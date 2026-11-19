import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { alertRule } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { and, eq } from "drizzle-orm";
import { err, ok } from "@repo/utils";
import { getAlertRuleInputSchema } from "../schema";

const createDiscardAlertRuleDraft =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (id: string, context: { appId: string; userId: string }) => {
    const validated = getAlertRuleInputSchema.safeParse(id);
    if (!validated.success) return err(validated.error.message);
    try {
      // One conditional delete protects rules saved by another tab while leaving.
      await db
        .delete(alertRule)
        .where(
          and(
            eq(alertRule.id, validated.data),
            eq(alertRule.appId, context.appId),
            eq(alertRule.createdBy, context.userId),
            eq(alertRule.isDraft, true),
            eq(alertRule.isEnabled, false),
            eq(alertRule.name, ""),
          ),
        );
      return ok(undefined);
    } catch (error) {
      recordError(error);
      logger.error(
        "discardAlertRuleDraft: failed to discard draft",
        error as Error,
      );
      return err("Failed to discard draft.");
    }
  };

export { createDiscardAlertRuleDraft };
