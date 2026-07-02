import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { AlertRuleService } from "../alert-rule";
import { IngestionKeyService } from "../ingestion-key";
import { createCreateApp } from "./methods/create-app";
import { createGetApp } from "./methods/get-app";
import { createListApps } from "./methods/list-apps";
import { createUpdateApp } from "./methods/update-app";
import {
  createAppInputSchema,
  getAppInputSchema,
  updateAppInputSchema,
} from "./schema";

@Instrument({ prefix: "app" })
class AppService {
  private logger: Logger;
  private listAppsMethod: ReturnType<typeof createListApps>;
  private getAppMethod: ReturnType<typeof createGetApp>;
  private createAppMethod: ReturnType<typeof createCreateApp>;
  private updateAppMethod: ReturnType<typeof createUpdateApp>;

  constructor(
    private db: DB,
    logger: Logger,
    private ingestionKeyService: IngestionKeyService,
    private alertRuleService: AlertRuleService,
  ) {
    this.logger = logger.child("AppService");
    this.listAppsMethod = createListApps({
      db: this.db,
      logger: this.logger,
    });
    this.getAppMethod = createGetApp({
      db: this.db,
      logger: this.logger,
    });
    this.createAppMethod = createCreateApp({
      db: this.db,
      logger: this.logger,
      ingestionKeyService: this.ingestionKeyService,
      alertRuleService: this.alertRuleService,
    });
    this.updateAppMethod = createUpdateApp({
      db: this.db,
      logger: this.logger,
    });
  }

  async listApps(context: { organizationId: string }) {
    return this.listAppsMethod(context);
  }

  async getApp(
    input: z.input<typeof getAppInputSchema>,
    context: { organizationId: string },
  ) {
    return this.getAppMethod(input, context);
  }

  async createApp(
    input: z.input<typeof createAppInputSchema>,
    context: { organizationId: string; userId: string },
  ) {
    return this.createAppMethod(input, context);
  }

  async updateApp(
    input: z.input<typeof updateAppInputSchema>,
    context: { organizationId: string; userId: string },
  ) {
    return this.updateAppMethod(input, context);
  }
}

export * from "./schema";
export { AppService };
