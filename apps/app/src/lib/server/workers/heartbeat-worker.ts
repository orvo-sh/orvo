import type { Logger } from "@repo/logger";

import { BaseWorker } from "./base-worker";

class HeartbeatWorker extends BaseWorker {
  name = "heartbeats";
  cron = "* * * * *";

  constructor(
    logger: Logger,
    private heartbeatService: {
      evaluateDueMonitors: () => Promise<unknown>;
    },
  ) {
    super(logger, "HeartbeatsWorker");
  }

  protected async run() {
    await this.heartbeatService.evaluateDueMonitors();
  }
}

export { HeartbeatWorker };
