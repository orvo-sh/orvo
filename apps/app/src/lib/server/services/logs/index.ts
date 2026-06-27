import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createGetLogFilterAttributes } from "./methods/get-log-filter-attributes";
import { createGetLogById } from "./methods/get-log-by-id";
import { createGetLogFilterValueSuggestions } from "./methods/get-log-filter-value-suggestions";
import { createGetLogServiceSummary } from "./methods/get-log-service-summary";
import {
  createGetLogServiceVolume,
  createGetLogVolume,
} from "./methods/get-log-volumes";
import { createGetLogs } from "./methods/get-logs";
import { createGetLogsTrend } from "./methods/get-logs-trend";
import { createGetTotalLogs } from "./methods/get-total-logs";
import {
  getLogByIdInputSchema,
  getLogFilterValueSuggestionsInputSchema,
  getLogServiceSummaryInputSchema,
  getLogServiceVolumeInputSchema,
  getLogsInputSchema,
  getLogVolumeInputSchema,
  getTotalLogsInputSchema,
} from "./schema";

@Instrument({ prefix: "logs" })
class LogsService {
  private logger: Logger;
  private getLogByIdMethod: ReturnType<typeof createGetLogById>;
  private getLogsMethod: ReturnType<typeof createGetLogs>;
  private getTotalLogsMethod: ReturnType<typeof createGetTotalLogs>;
  private getLogsTrendMethod: ReturnType<typeof createGetLogsTrend>;
  private getLogVolumeMethod: ReturnType<typeof createGetLogVolume>;
  private getLogServiceVolumeMethod: ReturnType<typeof createGetLogServiceVolume>;
  private getLogServiceSummaryMethod: ReturnType<typeof createGetLogServiceSummary>;
  private getLogFilterAttributesMethod: ReturnType<typeof createGetLogFilterAttributes>;
  private getLogFilterValueSuggestionsMethod: ReturnType<
    typeof createGetLogFilterValueSuggestions
  >;

  constructor(
    clickhouse: ClickHouse,
    logger: Logger,
  ) {
    this.logger = logger.child("LogsService");
    this.getLogByIdMethod = createGetLogById({
      clickhouse,
      logger: this.logger,
    });
    this.getLogsMethod = createGetLogs({
      clickhouse,
      logger: this.logger,
    });
    this.getTotalLogsMethod = createGetTotalLogs({
      clickhouse,
      logger: this.logger,
    });
    this.getLogsTrendMethod = createGetLogsTrend({
      clickhouse,
      logger: this.logger,
    });
    this.getLogVolumeMethod = createGetLogVolume({
      clickhouse,
      logger: this.logger,
    });
    this.getLogServiceVolumeMethod = createGetLogServiceVolume({
      clickhouse,
      logger: this.logger,
    });
    this.getLogServiceSummaryMethod = createGetLogServiceSummary({
      clickhouse,
      logger: this.logger,
    });
    this.getLogFilterAttributesMethod = createGetLogFilterAttributes({
      clickhouse,
      logger: this.logger,
    });
    this.getLogFilterValueSuggestionsMethod =
      createGetLogFilterValueSuggestions({
        clickhouse,
        logger: this.logger,
      });
  }

  async getLogs(
    input: z.input<typeof getLogsInputSchema>,
    context: { appId: string },
  ) {
    return this.getLogsMethod(input, context);
  }

  async getLogById(
    input: z.input<typeof getLogByIdInputSchema>,
    context: { appId: string },
  ) {
    return this.getLogByIdMethod(input, context);
  }

  async getTotalLogs(
    input: z.input<typeof getTotalLogsInputSchema>,
    context: { appId: string },
  ) {
    return this.getTotalLogsMethod(input, context);
  }

  async getLogsTrend(
    input: z.input<typeof getTotalLogsInputSchema>,
    context: { appId: string },
  ) {
    return this.getLogsTrendMethod(input, context);
  }

  async getLogVolume(
    input: z.input<typeof getLogVolumeInputSchema>,
    context: { appId: string },
  ) {
    return this.getLogVolumeMethod(input, context);
  }

  async getLogServiceVolume(
    input: z.input<typeof getLogServiceVolumeInputSchema>,
    context: { appId: string },
  ) {
    return this.getLogServiceVolumeMethod(input, context);
  }

  async getLogServiceSummary(
    input: z.input<typeof getLogServiceSummaryInputSchema>,
    context: { appId: string },
  ) {
    return this.getLogServiceSummaryMethod(input, context);
  }

  async getLogFilterAttributes(context: { appId: string }) {
    return this.getLogFilterAttributesMethod(context);
  }

  async getLogFilterValueSuggestions(
    input: z.input<typeof getLogFilterValueSuggestionsInputSchema>,
    context: { appId: string },
  ) {
    return this.getLogFilterValueSuggestionsMethod(input, context);
  }
}

export * from "./schema";
export { LogsService };
