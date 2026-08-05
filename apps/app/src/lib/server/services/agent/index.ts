import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import type { IngestionKeyService } from "../ingestion-key";
import { createCreateEnrollment } from "./methods/create-enrollment";
import { createGetHosts } from "./methods/get-hosts";
import { createRedeemEnrollment } from "./methods/redeem-enrollment";
import { createAgentEnrollmentInputSchema } from "./schema";

@Instrument({ prefix: "agent" })
class AgentService {
  private createEnrollmentMethod: ReturnType<typeof createCreateEnrollment>;
  private getHostsMethod: ReturnType<typeof createGetHosts>;
  private redeemEnrollmentMethod: ReturnType<typeof createRedeemEnrollment>;

  constructor(
    db: DB,
    clickhouse: ClickHouse,
    logger: Logger,
    ingestionKeyService: IngestionKeyService,
    config: { appBaseUrl: string; ingestBaseUrl: string },
  ) {
    const childLogger = logger.child("AgentService");
    this.createEnrollmentMethod = createCreateEnrollment({
      db,
      logger: childLogger,
      config,
    });
    this.getHostsMethod = createGetHosts({
      db,
      clickhouse,
      logger: childLogger,
    });
    this.redeemEnrollmentMethod = createRedeemEnrollment({
      db,
      logger: childLogger,
      ingestionKeyService,
      config,
    });
  }

  async createEnrollment(
    input: z.input<typeof createAgentEnrollmentInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.createEnrollmentMethod(input, context);
  }

  async getHosts(context: { appId: string }) {
    return this.getHostsMethod(context);
  }

  async redeemEnrollment(input: unknown) {
    return this.redeemEnrollmentMethod(input);
  }
}

export * from "./schema";
export { AgentService };
