import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import type { IncidentService } from "../incident";
import { createCreateHeartbeatMonitor } from "./methods/create-heartbeat-monitor";
import { createDeleteHeartbeatMonitor } from "./methods/delete-heartbeat-monitor";
import { createEvaluateDueMonitors } from "./methods/evaluate-due-monitors";
import { createGetHeartbeatCheckInHistory } from "./methods/get-heartbeat-check-in-history";
import { createGetHeartbeatMonitor } from "./methods/get-heartbeat-monitor";
import { createListHeartbeatMonitors } from "./methods/list-heartbeat-monitors";
import { createRecordHeartbeatCheckInBySecret } from "./methods/record-heartbeat-check-in-by-secret";
import { createRegenerateHeartbeatMonitorSecret } from "./methods/regenerate-heartbeat-monitor-secret";
import { createSendHeartbeatMonitorTestAlert } from "./methods/send-heartbeat-monitor-test-alert";
import { createToggleHeartbeatMonitorPaused } from "./methods/toggle-heartbeat-monitor-paused";
import { createUpdateHeartbeatMonitor } from "./methods/update-heartbeat-monitor";
import {
  createHeartbeatMonitorInputSchema,
  deleteHeartbeatMonitorInputSchema,
  getHeartbeatMonitorInputSchema,
  recordHeartbeatCheckInBySecretInputSchema,
  regenerateHeartbeatMonitorSecretInputSchema,
  sendHeartbeatMonitorTestAlertInputSchema,
  toggleHeartbeatMonitorPausedInputSchema,
  updateHeartbeatMonitorInputSchema,
} from "./schema";
import {
  createInsertHeartbeatDeliveries,
  createLoadDestinations,
  createOpenHeartbeatIncident,
} from "./shared";

@Instrument({ prefix: "heartbeat" })
class HeartbeatService {
  private logger: Logger;
  private listHeartbeatMonitorsMethod: ReturnType<
    typeof createListHeartbeatMonitors
  >;
  private getHeartbeatMonitorMethod: ReturnType<typeof createGetHeartbeatMonitor>;
  private getHeartbeatCheckInHistoryMethod: ReturnType<
    typeof createGetHeartbeatCheckInHistory
  >;
  private createHeartbeatMonitorMethod: ReturnType<
    typeof createCreateHeartbeatMonitor
  >;
  private updateHeartbeatMonitorMethod: ReturnType<
    typeof createUpdateHeartbeatMonitor
  >;
  private deleteHeartbeatMonitorMethod: ReturnType<
    typeof createDeleteHeartbeatMonitor
  >;
  private regenerateHeartbeatMonitorSecretMethod: ReturnType<
    typeof createRegenerateHeartbeatMonitorSecret
  >;
  private toggleHeartbeatMonitorPausedMethod: ReturnType<
    typeof createToggleHeartbeatMonitorPaused
  >;
  private sendHeartbeatMonitorTestAlertMethod: ReturnType<
    typeof createSendHeartbeatMonitorTestAlert
  >;
  private recordHeartbeatCheckInBySecretMethod: ReturnType<
    typeof createRecordHeartbeatCheckInBySecret
  >;
  private evaluateDueMonitorsMethod: ReturnType<typeof createEvaluateDueMonitors>;

  constructor(
    db: DB,
    clickhouse: ClickHouse,
    logger: Logger,
    incidentService: IncidentService,
    config: { ingestBaseUrl: string; appBaseUrl: string },
  ) {
    this.logger = logger.child("HeartbeatService");
    const loadDestinations = createLoadDestinations({
      db,
    });
    const openHeartbeatIncident = createOpenHeartbeatIncident({
      db,
      incidentService,
      config,
    });
    const insertHeartbeatDeliveries = createInsertHeartbeatDeliveries({
      config,
    });

    this.listHeartbeatMonitorsMethod = createListHeartbeatMonitors({
      db,
      logger: this.logger,
      config,
    });
    this.getHeartbeatMonitorMethod = createGetHeartbeatMonitor({
      db,
      logger: this.logger,
      config,
    });
    this.getHeartbeatCheckInHistoryMethod = createGetHeartbeatCheckInHistory({
      db,
      clickhouse,
      logger: this.logger,
    });
    this.createHeartbeatMonitorMethod = createCreateHeartbeatMonitor({
      db,
      logger: this.logger,
      loadDestinations,
      config,
    });
    this.updateHeartbeatMonitorMethod = createUpdateHeartbeatMonitor({
      db,
      logger: this.logger,
      loadDestinations,
    });
    this.deleteHeartbeatMonitorMethod = createDeleteHeartbeatMonitor({
      db,
      logger: this.logger,
      incidentService,
    });
    this.regenerateHeartbeatMonitorSecretMethod =
      createRegenerateHeartbeatMonitorSecret({
        db,
        logger: this.logger,
        config,
      });
    this.toggleHeartbeatMonitorPausedMethod =
      createToggleHeartbeatMonitorPaused({
        db,
        logger: this.logger,
        incidentService,
      });
    this.sendHeartbeatMonitorTestAlertMethod =
      createSendHeartbeatMonitorTestAlert({
        db,
        logger: this.logger,
        config,
      });
    this.recordHeartbeatCheckInBySecretMethod =
      createRecordHeartbeatCheckInBySecret({
        db,
        logger: this.logger,
        incidentService,
        insertHeartbeatDeliveries,
      });
    this.evaluateDueMonitorsMethod = createEvaluateDueMonitors({
      db,
      logger: this.logger,
      openHeartbeatIncident,
      insertHeartbeatDeliveries,
    });
  }

  async listHeartbeatMonitors(context: { appId: string }) {
    return this.listHeartbeatMonitorsMethod(context);
  }

  async getHeartbeatMonitor(
    input: z.input<typeof getHeartbeatMonitorInputSchema>,
    context: { appId: string },
  ) {
    return this.getHeartbeatMonitorMethod(input, context);
  }

  async getHeartbeatCheckInHistory(
    input: z.input<typeof getHeartbeatMonitorInputSchema>,
    context: { appId: string },
  ) {
    return this.getHeartbeatCheckInHistoryMethod(input, context);
  }

  async createHeartbeatMonitor(
    input: z.input<typeof createHeartbeatMonitorInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.createHeartbeatMonitorMethod(input, context);
  }

  async updateHeartbeatMonitor(
    input: z.input<typeof updateHeartbeatMonitorInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.updateHeartbeatMonitorMethod(input, context);
  }

  async deleteHeartbeatMonitor(
    input: z.input<typeof deleteHeartbeatMonitorInputSchema>,
    context: { appId: string },
  ) {
    return this.deleteHeartbeatMonitorMethod(input, context);
  }

  async regenerateHeartbeatMonitorSecret(
    input: z.input<typeof regenerateHeartbeatMonitorSecretInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.regenerateHeartbeatMonitorSecretMethod(input, context);
  }

  async toggleHeartbeatMonitorPaused(
    input: z.input<typeof toggleHeartbeatMonitorPausedInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.toggleHeartbeatMonitorPausedMethod(input, context);
  }

  async sendHeartbeatMonitorTestAlert(
    input: z.input<typeof sendHeartbeatMonitorTestAlertInputSchema>,
    context: { appId: string },
  ) {
    return this.sendHeartbeatMonitorTestAlertMethod(input, context);
  }

  async recordHeartbeatCheckInBySecret(
    input: z.input<typeof recordHeartbeatCheckInBySecretInputSchema>,
  ) {
    return this.recordHeartbeatCheckInBySecretMethod(input);
  }

  async evaluateDueMonitors() {
    return this.evaluateDueMonitorsMethod();
  }
}

export * from "./schema";
export { HeartbeatService };
