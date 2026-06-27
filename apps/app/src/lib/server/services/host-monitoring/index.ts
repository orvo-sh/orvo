import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import type { IncidentService } from "../incident";
import type { IngestionKeyService } from "../ingestion-key";
import { createCreateInstallSession } from "./methods/create-install-session";
import { createEvaluateHostIncidents } from "./methods/evaluate-host-incidents";
import { createGetHostDetail } from "./methods/get-host-detail";
import { createGetHosts } from "./methods/get-hosts";
import { createGetInstallBundle } from "./methods/get-install-bundle";
import {
  createHostInstallSessionInputSchema,
  getHostDetailInputSchema,
  getHostInstallBundleInputSchema,
  getHostsInputSchema,
} from "./schema";
import { createGetPrivateIngestionKey } from "./shared";

@Instrument({ prefix: "hostMonitoring" })
class HostMonitoringService {
  private logger: Logger;
  private createInstallSessionMethod: ReturnType<typeof createCreateInstallSession>;
  private getInstallBundleMethod: ReturnType<typeof createGetInstallBundle>;
  private getHostsMethod: ReturnType<typeof createGetHosts>;
  private getHostDetailMethod: ReturnType<typeof createGetHostDetail>;
  private evaluateHostIncidentsMethod: ReturnType<
    typeof createEvaluateHostIncidents
  >;

  constructor(
    db: DB,
    clickhouse: ClickHouse,
    encryption: Encryption,
    logger: Logger,
    incidentService: IncidentService,
    ingestionKeyService: IngestionKeyService,
    config: {
      appBaseUrl: string;
      cdnBaseUrl: string;
      otlpBaseUrl: string;
    },
  ) {
    this.logger = logger.child("HostMonitoringService");
    const getPrivateIngestionKey = createGetPrivateIngestionKey({
      db,
    });
    this.createInstallSessionMethod = createCreateInstallSession({
      encryption,
      logger: this.logger,
      ingestionKeyService,
      getPrivateIngestionKey,
      config,
    });
    this.getInstallBundleMethod = createGetInstallBundle({
      encryption,
      logger: this.logger,
      getPrivateIngestionKey,
      config,
    });
    this.getHostsMethod = createGetHosts({
      db,
      clickhouse,
      logger: this.logger,
    });
    this.getHostDetailMethod = createGetHostDetail({
      db,
      clickhouse,
      logger: this.logger,
    });
    this.evaluateHostIncidentsMethod = createEvaluateHostIncidents({
      clickhouse,
      logger: this.logger,
      incidentService,
    });
  }

  async createInstallSession(
    input: z.input<typeof createHostInstallSessionInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.createInstallSessionMethod(input, context);
  }

  async getInstallBundle(
    input: z.input<typeof getHostInstallBundleInputSchema>,
  ) {
    return this.getInstallBundleMethod(input);
  }

  async getHosts(
    input: z.input<typeof getHostsInputSchema>,
    context: { appId: string },
  ) {
    return this.getHostsMethod(input, context);
  }

  async getHostDetail(
    input: z.input<typeof getHostDetailInputSchema>,
    context: { appId: string },
  ) {
    return this.getHostDetailMethod(input, context);
  }

  async evaluateHostIncidents() {
    return this.evaluateHostIncidentsMethod();
  }
}

export * from "./schema";
export { HostMonitoringService };
