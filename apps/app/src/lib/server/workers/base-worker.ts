import type { Logger } from "@repo/logger";
import type { PgBoss } from "pg-boss";

type WorkerJob = {
  id: string;
  data: unknown;
};

abstract class BaseWorker {
  protected logger: Logger;

  abstract name: string;
  abstract cron: string | null;

  constructor(logger: Logger, name: string) {
    this.logger = logger.child(name);
  }

  async register(boss: PgBoss) {
    await boss.createQueue(this.name);

    if (this.cron) {
      await boss.schedule(this.name, this.cron, {}, { key: this.name });
    }

    await boss.work(this.name, async (jobs) => {
      for (const job of jobs) {
        await this.run(job);
      }
    });
  }

  protected abstract run(job: WorkerJob): Promise<void>;
}

export { BaseWorker };
