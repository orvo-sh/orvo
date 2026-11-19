import { createEmptyAlertRuleForm } from "$lib/alerts";
import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { alertRule } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";

const createCreateAlertRuleDraft =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (context: { appId: string; userId: string }) => {
    try {
      const defaults = createEmptyAlertRuleForm();
      const id = genId("alrt");
      await db.insert(alertRule).values({
        id,
        appId: context.appId,
        name: "",
        comparator: defaults.comparator,
        threshold: defaults.threshold,
        windowMinutes: defaults.windowMinutes,
        renotifyMinutes: defaults.renotifyMinutes,
        isDraft: true,
        isEnabled: false,
        createdBy: context.userId,
        updatedBy: context.userId,
      });
      return ok({ id });
    } catch (error) {
      recordError(error);
      logger.error(
        "createAlertRuleDraft: failed to create draft",
        error as Error,
      );
      return err("Failed to create alert rule draft.");
    }
  };

export { createCreateAlertRuleDraft };
