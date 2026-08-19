import type { AlertRuleService } from "$lib/server/services/alert-rule";
import type { AppService } from "$lib/server/services/app";
import type { HeartbeatService } from "$lib/server/services/heartbeat";
import type { IncidentService } from "$lib/server/services/incident";
import type { LogsService } from "$lib/server/services/logs";
import type { MetricsService } from "$lib/server/services/metrics";
import type { TracesService } from "$lib/server/services/traces";

import { createMcpServer } from "./methods/create-server";

class McpService {
  constructor(
    private dependencies: {
      alertRuleService: AlertRuleService;
      appService: AppService;
      heartbeatService: HeartbeatService;
      incidentService: IncidentService;
      logsService: LogsService;
      metricsService: MetricsService;
      tracesService: TracesService;
    },
  ) {}

  createServer(context: { organizationId: string }) {
    return createMcpServer(this.dependencies, context);
  }
}

export { McpService };
