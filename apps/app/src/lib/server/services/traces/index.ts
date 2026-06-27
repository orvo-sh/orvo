import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createGetServiceGraph } from "./methods/get-service-graph";
import { createGetTotalTraces, createGetTracesTrend } from "./methods/get-total-traces";
import { createGetTrace } from "./methods/get-trace";
import { createGetTraceFilterAttributes } from "./methods/get-trace-filter-attributes";
import { createGetTraceFilterValueSuggestions } from "./methods/get-trace-filter-value-suggestions";
import { createGetTraceMetrics } from "./methods/get-trace-metrics";
import { createGetTraceServiceSummary } from "./methods/get-trace-service-summary";
import { createGetTraceSummary } from "./methods/get-trace-summary";
import { createGetTraces } from "./methods/get-traces";
import {
  getServiceGraphInputSchema,
  getTotalTracesInputSchema,
  getTraceFilterValueSuggestionsInputSchema,
  getTraceInputSchema,
  getTraceMetricsInputSchema,
  getTraceServiceSummaryInputSchema,
  getTraceSummaryInputSchema,
  getTracesInputSchema,
} from "./schema";

@Instrument({ prefix: "traces" })
class TracesService {
  private logger: Logger;
  private getTotalTracesMethod: ReturnType<typeof createGetTotalTraces>;
  private getTracesTrendMethod: ReturnType<typeof createGetTracesTrend>;
  private getTracesMethod: ReturnType<typeof createGetTraces>;
  private getTraceFilterAttributesMethod: ReturnType<
    typeof createGetTraceFilterAttributes
  >;
  private getTraceFilterValueSuggestionsMethod: ReturnType<
    typeof createGetTraceFilterValueSuggestions
  >;
  private getTraceSummaryMethod: ReturnType<typeof createGetTraceSummary>;
  private getTraceMetricsMethod: ReturnType<typeof createGetTraceMetrics>;
  private getTraceServiceSummaryMethod: ReturnType<
    typeof createGetTraceServiceSummary
  >;
  private getServiceGraphMethod: ReturnType<typeof createGetServiceGraph>;
  private getTraceMethod: ReturnType<typeof createGetTrace>;

  constructor(
    clickhouse: ClickHouse,
    logger: Logger,
  ) {
    this.logger = logger.child("TracesService");
    this.getTotalTracesMethod = createGetTotalTraces({
      clickhouse,
      logger: this.logger,
    });
    this.getTracesTrendMethod = createGetTracesTrend({
      clickhouse,
      logger: this.logger,
    });
    this.getTracesMethod = createGetTraces({
      clickhouse,
      logger: this.logger,
    });
    this.getTraceFilterAttributesMethod = createGetTraceFilterAttributes({
      clickhouse,
      logger: this.logger,
    });
    this.getTraceFilterValueSuggestionsMethod =
      createGetTraceFilterValueSuggestions({
        clickhouse,
        logger: this.logger,
      });
    this.getTraceSummaryMethod = createGetTraceSummary({
      clickhouse,
      logger: this.logger,
    });
    this.getTraceMetricsMethod = createGetTraceMetrics({
      clickhouse,
      logger: this.logger,
    });
    this.getTraceServiceSummaryMethod = createGetTraceServiceSummary({
      clickhouse,
      logger: this.logger,
    });
    this.getServiceGraphMethod = createGetServiceGraph({
      clickhouse,
      logger: this.logger,
    });
    this.getTraceMethod = createGetTrace({
      clickhouse,
      logger: this.logger,
    });
  }

  async getTotalTraces(
    input: z.input<typeof getTotalTracesInputSchema>,
    context: { appId: string },
  ) {
    return this.getTotalTracesMethod(input, context);
  }

  async getTracesTrend(
    input: z.input<typeof getTotalTracesInputSchema>,
    context: { appId: string },
  ) {
    return this.getTracesTrendMethod(input, context);
  }

  async getTraces(
    input: z.input<typeof getTracesInputSchema>,
    context: { appId: string },
  ) {
    return this.getTracesMethod(input, context);
  }

  async getTraceFilterAttributes(context: { appId: string }) {
    return this.getTraceFilterAttributesMethod(context);
  }

  async getTraceFilterValueSuggestions(
    input: z.input<typeof getTraceFilterValueSuggestionsInputSchema>,
    context: { appId: string },
  ) {
    return this.getTraceFilterValueSuggestionsMethod(input, context);
  }

  async getTraceSummary(
    input: z.input<typeof getTraceSummaryInputSchema>,
    context: { appId: string },
  ) {
    return this.getTraceSummaryMethod(input, context);
  }

  async getTraceMetrics(
    input: z.input<typeof getTraceMetricsInputSchema>,
    context: { appId: string },
  ) {
    return this.getTraceMetricsMethod(input, context);
  }

  async getTraceServiceSummary(
    input: z.input<typeof getTraceServiceSummaryInputSchema>,
    context: { appId: string },
  ) {
    return this.getTraceServiceSummaryMethod(input, context);
  }

  async getServiceGraph(
    input: z.input<typeof getServiceGraphInputSchema>,
    context: { appId: string },
  ) {
    return this.getServiceGraphMethod(input, context);
  }

  async getTrace(
    input: z.input<typeof getTraceInputSchema>,
    context: { appId: string },
  ) {
    return this.getTraceMethod(input, context);
  }
}

export * from "./schema";
export { TracesService };
