import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import type { IngestionKeyService } from "../ingestion-key";
import { createCreateEnrollment } from "./methods/create-enrollment";
import { createDeleteHost } from "./methods/delete-host";
import { createGetHost } from "./methods/get-host";
import { createGetHosts } from "./methods/get-hosts";
import { createRedeemEnrollment } from "./methods/redeem-enrollment";
import { createUpdateHost } from "./methods/update-host";
import {
  createAgentEnrollmentInputSchema,
  deleteHostInputSchema,
  getHostInputSchema,
  updateHostInputSchema,
} from "./schema";

@Instrument({ prefix: "agent" })
class AgentService {
  private createEnrollmentMethod: ReturnType<typeof createCreateEnrollment>;
  private deleteHostMethod: ReturnType<typeof createDeleteHost>;
  private getHostMethod: ReturnType<typeof createGetHost>;
  private getHostsMethod: ReturnType<typeof createGetHosts>;
  private redeemEnrollmentMethod: ReturnType<typeof createRedeemEnrollment>;
  private updateHostMethod: ReturnType<typeof createUpdateHost>;

  constructor(
    db: DB,
    clickhouse: ClickHouse,
    logger: Logger,
    ingestionKeyService: IngestionKeyService,
    config: { ingestBaseUrl: string },
  ) {
    const childLogger = logger.child("AgentService");
    this.createEnrollmentMethod = createCreateEnrollment({
      db,
      logger: childLogger,
    });
    this.deleteHostMethod = createDeleteHost({ db, logger: childLogger });
    this.getHostMethod = createGetHost({ db, clickhouse, logger: childLogger });
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
    this.updateHostMethod = createUpdateHost({ db, logger: childLogger });
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

  async getHost(
    input: z.input<typeof getHostInputSchema>,
    context: { appId: string },
  ) {
    return this.getHostMethod(input, context);
  }

  async updateHost(
    input: z.input<typeof updateHostInputSchema>,
    context: { appId: string },
  ) {
    return this.updateHostMethod(input, context);
  }

  async deleteHost(
    input: z.input<typeof deleteHostInputSchema>,
    context: { appId: string },
  ) {
    return this.deleteHostMethod(input, context);
  }

  async redeemEnrollment(input: unknown) {
    return this.redeemEnrollmentMethod(input);
  }
}

export * from "./schema";
export { AgentService };
