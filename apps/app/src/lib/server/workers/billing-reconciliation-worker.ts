import type { BillingService } from "$lib/server/services/billing";
import type { Logger } from "@repo/logger";

import { BaseWorker } from "./base-worker";

class BillingReconciliationWorker extends BaseWorker {
  name = "billing-reconciliation";
  cron = "0 */6 * * *";

  constructor(
    logger: Logger,
    private billingService: BillingService,
  ) {
    super(logger, "BillingReconciliationWorker");
  }

  protected async run() {
    await this.billingService.reconcileSubscriptions();
  }
}

export { BillingReconciliationWorker };
