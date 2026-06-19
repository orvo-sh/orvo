import type { Logger } from "@repo/logger";

import { BaseWorker } from "./base-worker";

class NotificationDeliveryWorker extends BaseWorker {
  name = "notification-deliveries";
  cron = "* * * * *";

  constructor(
    logger: Logger,
    private notificationDeliveryService: {
      processDueDeliveries: (limit?: number) => Promise<unknown>;
    },
  ) {
    super(logger, "NotificationDeliveryWorker");
  }

  protected async run() {
    await this.notificationDeliveryService.processDueDeliveries();
  }
}

export { NotificationDeliveryWorker };
