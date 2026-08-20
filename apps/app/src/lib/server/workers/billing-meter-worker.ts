import type { BillingService } from "$lib/server/services/billing";
import type { Logger } from "@repo/logger";

import { BaseWorker } from "./base-worker";

class BillingMeterWorker extends BaseWorker {
  name = "billing-meter-usage";
  cron = "*/5 * * * *";

  constructor(
    logger: Logger,
    private billingService: BillingService,
  ) {
    super(logger, "BillingMeterWorker");
  }

  protected async run() {
    await this.billingService.syncMeterUsage();
  }
}

export { BillingMeterWorker };
