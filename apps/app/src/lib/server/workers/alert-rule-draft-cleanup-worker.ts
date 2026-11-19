import type { DB } from "@repo/db";
import { alertRule } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { and, eq, lt } from "drizzle-orm";
import { BaseWorker } from "./base-worker";

class AlertRuleDraftCleanupWorker extends BaseWorker {
  name = "alert-rule-draft-cleanup";
  cron = "0 0 * * *";

  constructor(
    logger: Logger,
    private db: DB,
  ) {
    super(logger, "AlertRuleDraftCleanupWorker");
  }

  protected async run() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.db
      .delete(alertRule)
      .where(
        and(
          eq(alertRule.isDraft, true),
          eq(alertRule.isEnabled, false),
          eq(alertRule.name, ""),
          lt(alertRule.updatedAt, cutoff),
        ),
      );
  }
}

export { AlertRuleDraftCleanupWorker };
