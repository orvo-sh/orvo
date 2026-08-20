import { recordError } from "$lib/instrumentation";
import { eq, type DB } from "@repo/db";
import { organizationUsage } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

const createGetUsage =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (context: { organizationId: string }) => {
    try {
      const usage = await db.query.organizationUsage.findFirst({
        columns: {
          chatCreditsIncluded: true,
          chatCreditsUsed: true,
          currentPeriodEnd: true,
        },
        where: eq(organizationUsage.organizationId, context.organizationId),
      });

      if (!usage) {
        return err("Failed to load chat usage.");
      }

      const remainingCredits = Math.max(
        0,
        usage.chatCreditsIncluded - usage.chatCreditsUsed,
      );

      return ok({
        includedCredits: usage.chatCreditsIncluded,
        usedCredits: usage.chatCreditsUsed,
        remainingCredits,
        periodEnd: usage.currentPeriodEnd,
      });
    } catch (error) {
      recordError(error);
      logger.error("getUsage: failed to load chat usage", error as Error);
      return err("Failed to load chat usage.");
    }
  };

export { createGetUsage };
