import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB, Tx } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createDiscardAlertRuleDraft } from "./methods/discard-alert-rule-draft";
import { createTouchAlertRuleDraft } from "./methods/touch-alert-rule-draft";
import { createCreateAlertRuleDraft } from "./methods/create-alert-rule-draft";
import { createCreateAlertRule } from "./methods/create-alert-rule";
import { createDeleteAlertRule } from "./methods/delete-alert-rule";
import { createGetAlertRule } from "./methods/get-alert-rule";
import { createGetAlertRules } from "./methods/get-alert-rules";
import { createSeedDefaultAlertRules } from "./methods/seed-default-alert-rules";
import { createSetAlertRuleEnabled } from "./methods/set-alert-rule-enabled";
import { createUpdateAlertRule } from "./methods/update-alert-rule";
import {
  createAlertRuleInputSchema,
  deleteAlertRuleInputSchema,
  getAlertRuleInputSchema,
  setAlertRuleEnabledInputSchema,
  updateAlertRuleInputSchema,
} from "./schema";

@Instrument({ prefix: "alertRule" })
class AlertRuleService {
  private logger: Logger;
  private discardAlertRuleDraftMethod: ReturnType<
    typeof createDiscardAlertRuleDraft
  >;
  private touchAlertRuleDraftMethod: ReturnType<
    typeof createTouchAlertRuleDraft
  >;
  private createAlertRuleDraftMethod: ReturnType<
    typeof createCreateAlertRuleDraft
  >;
  private getAlertRulesMethod: ReturnType<typeof createGetAlertRules>;
  private getAlertRuleMethod: ReturnType<typeof createGetAlertRule>;
  private createAlertRuleMethod: ReturnType<typeof createCreateAlertRule>;
  private updateAlertRuleMethod: ReturnType<typeof createUpdateAlertRule>;
  private setAlertRuleEnabledMethod: ReturnType<
    typeof createSetAlertRuleEnabled
  >;
  private deleteAlertRuleMethod: ReturnType<typeof createDeleteAlertRule>;
  private seedDefaultAlertRulesMethod: ReturnType<
    typeof createSeedDefaultAlertRules
  >;

  constructor(db: DB, logger: Logger, clickhouse?: ClickHouse) {
    this.logger = logger.child("AlertRuleService");
    this.discardAlertRuleDraftMethod = createDiscardAlertRuleDraft({
      db,
      logger: this.logger,
    });
    this.touchAlertRuleDraftMethod = createTouchAlertRuleDraft({
      db,
      logger: this.logger,
    });
    this.createAlertRuleDraftMethod = createCreateAlertRuleDraft({
      db,
      logger: this.logger,
    });
    this.getAlertRulesMethod = createGetAlertRules({
      db,
      logger: this.logger,
    });
    this.getAlertRuleMethod = createGetAlertRule({
      db,
      logger: this.logger,
    });
    this.createAlertRuleMethod = createCreateAlertRule({
      db,
      clickhouse,
      logger: this.logger,
    });
    this.updateAlertRuleMethod = createUpdateAlertRule({
      db,
      clickhouse,
      logger: this.logger,
    });
    this.setAlertRuleEnabledMethod = createSetAlertRuleEnabled({
      db,
      logger: this.logger,
    });
    this.deleteAlertRuleMethod = createDeleteAlertRule({
      db,
      logger: this.logger,
    });
    this.seedDefaultAlertRulesMethod = createSeedDefaultAlertRules({
      db,
      logger: this.logger,
    });
  }

  async getAlertRules(context: { appId: string }) {
    return this.getAlertRulesMethod(context);
  }

  async getAlertRule(
    input: z.input<typeof getAlertRuleInputSchema>,
    context: { appId: string },
  ) {
    return this.getAlertRuleMethod(input, context);
  }

  async discardAlertRuleDraft(
    id: string,
    context: { appId: string; userId: string },
  ) {
    return this.discardAlertRuleDraftMethod(id, context);
  }

  async touchAlertRuleDraft(
    id: string,
    context: { appId: string; userId: string },
  ) {
    return this.touchAlertRuleDraftMethod(id, context);
  }

  async createAlertRuleDraft(context: { appId: string; userId: string }) {
    return this.createAlertRuleDraftMethod(context);
  }

  async createAlertRule(
    input: z.input<typeof createAlertRuleInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.createAlertRuleMethod(input, context);
  }

  async updateAlertRule(
    input: z.input<typeof updateAlertRuleInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.updateAlertRuleMethod(input, context);
  }

  async setAlertRuleEnabled(
    input: z.input<typeof setAlertRuleEnabledInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.setAlertRuleEnabledMethod(input, context);
  }

  async deleteAlertRule(
    input: z.input<typeof deleteAlertRuleInputSchema>,
    context: { appId: string },
  ) {
    return this.deleteAlertRuleMethod(input, context);
  }

  async seedDefaultAlertRules(
    context: { appId: string; userId: string },
    tx?: Tx,
  ) {
    return this.seedDefaultAlertRulesMethod(context, tx);
  }
}

export * from "./schema";
export { AlertRuleService };
