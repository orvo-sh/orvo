import type { Logger } from "@repo/logger";

import { BaseWorker } from "./base-worker";

class HostIncidentWorker extends BaseWorker {
  name = "host-incidents";
  cron = "* * * * *";

  constructor(
    logger: Logger,
    private hostMonitoringService: {
      evaluateHostIncidents: () => Promise<unknown>;
    },
  ) {
    super(logger, "HostIncidentWorker");
  }

  protected async run() {
    await this.hostMonitoringService.evaluateHostIncidents();
  }
}

export { HostIncidentWorker };
