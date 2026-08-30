import { recordError } from "$lib/instrumentation";
import { PLANS } from "$lib/constants";
import { eq, type DB } from "@repo/db";
import { organizationUsage } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

const createGetUsage =
  ({
    db,
    logger,
    config,
  }: {
    db: DB;
    logger: Logger;
    config: { allowUnmetered: boolean };
  }) =>
  async (context: { organizationId: string }) => {
    try {
      const usage = await db.query.organizationUsage.findFirst({
        columns: {
          chatCreditsIncluded: true,
          chatCreditsUsed: true,
          currentPeriodEnd: true,
          scoutOverageEnabled: true,
          scoutOverageBudgetCents: true,
        },
        with: {
          organization: {
            columns: { billingPlan: true, billingStatus: true },
          },
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
      const overageCredits = Math.max(
        0,
        usage.chatCreditsUsed - usage.chatCreditsIncluded,
      );
      const overageCostCents =
        (overageCredits / 1_000) *
        PLANS.pro.scoutOveragePricePerThousandCredits *
        100;

      return ok({
        includedCredits: usage.chatCreditsIncluded,
        usedCredits: usage.chatCreditsUsed,
        remainingCredits,
        overageCredits,
        overageCostCents,
        overageEnabled: usage.scoutOverageEnabled,
        overageBudgetCents: usage.scoutOverageBudgetCents,
        canUseOverage:
          config.allowUnmetered ||
          (usage.organization.billingPlan === "pro" &&
            usage.organization.billingStatus === "active" &&
            usage.scoutOverageEnabled &&
            (usage.scoutOverageBudgetCents === null ||
              overageCostCents < usage.scoutOverageBudgetCents)),
        periodEnd: usage.currentPeriodEnd,
      });
    } catch (error) {
      recordError(error);
      logger.error("getUsage: failed to load chat usage", error as Error);
      return err("Failed to load chat usage.");
    }
  };

export { createGetUsage };
