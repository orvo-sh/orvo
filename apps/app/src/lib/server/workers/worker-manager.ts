import type { Logger } from "@repo/logger";
import { PgBoss } from "pg-boss";

import type { BaseWorker } from "./base-worker";

class WorkerManager {
  constructor(
    private boss: PgBoss,
    private logger: Logger,
    private workers: BaseWorker[],
  ) {}

  async start() {
    this.boss.on("error", (error) => {
      this.logger.error("WorkerManager: pg-boss error", error);
    });

    await this.boss.start();

    for (const worker of this.workers) {
      await worker.register(this.boss);
    }

    this.logger.info("WorkerManager: workers started", {
      workers: this.workers.map((worker) => worker.name),
    });
  }
}

export { WorkerManager };
