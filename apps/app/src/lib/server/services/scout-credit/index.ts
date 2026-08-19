import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { err } from "@repo/utils";

import { createGetBalance } from "./methods/get-balance";
import { createRecordUsage } from "./methods/record-usage";
import { createEnsurePlanGrant } from "./methods/shared";

@Instrument({ prefix: "scoutCredit" })
class ScoutCreditService {
  private getBalanceMethod: ReturnType<typeof createGetBalance>;
  private recordUsageMethod: ReturnType<typeof createRecordUsage>;

  constructor(db: DB, logger: Logger) {
    const childLogger = logger.child("ScoutCreditService");
    const ensurePlanGrant = createEnsurePlanGrant({ db });
    this.getBalanceMethod = createGetBalance({
      db,
      logger: childLogger,
      ensurePlanGrant,
    });
    this.recordUsageMethod = createRecordUsage({ db, logger: childLogger });
  }

  async getBalance(context: { organizationId: string }) {
    return this.getBalanceMethod(context);
  }

  async canStart(context: { organizationId: string }) {
    const balance = await this.getBalanceMethod(context);
    if (!balance.success) return balance;
    return balance.data.total > 0
      ? balance
      : err(
          "This organization has used its Scout credits for the current billing period.",
        );
  }

  async recordUsage(
    input: Parameters<ReturnType<typeof createRecordUsage>>[0],
  ) {
    return this.recordUsageMethod(input);
  }
}

export { ScoutCreditService };
export {
  allocateScoutCredits,
  calculateScoutCredits,
  SCOUT_CREDIT_POLICY_VERSION,
} from "./methods/shared";
