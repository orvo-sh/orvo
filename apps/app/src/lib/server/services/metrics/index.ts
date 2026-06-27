import { Instrument } from "$lib/instrumentation";
import type { ClickHouse } from "@repo/clickhouse";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createGetMetricCatalog } from "./methods/get-metric-catalog";
import { createGetMetricsExplorer } from "./methods/get-metrics-explorer";
import {
  createGetMetricsTrend,
  createGetTotalMetrics,
} from "./methods/get-total-metrics";
import {
  getMetricCatalogInputSchema,
  getMetricsExplorerInputSchema,
  getTotalMetricsInputSchema,
} from "./schema";

@Instrument({ prefix: "metrics" })
class MetricsService {
  private logger: Logger;
  private getTotalMetricsMethod: ReturnType<typeof createGetTotalMetrics>;
  private getMetricsTrendMethod: ReturnType<typeof createGetMetricsTrend>;
  private getMetricCatalogMethod: ReturnType<typeof createGetMetricCatalog>;
  private getMetricsExplorerMethod: ReturnType<typeof createGetMetricsExplorer>;

  constructor(
    clickhouse: ClickHouse,
    logger: Logger,
  ) {
    this.logger = logger.child("MetricsService");
    this.getTotalMetricsMethod = createGetTotalMetrics({
      clickhouse,
      logger: this.logger,
    });
    this.getMetricsTrendMethod = createGetMetricsTrend({
      clickhouse,
      logger: this.logger,
    });
    this.getMetricCatalogMethod = createGetMetricCatalog({
      clickhouse,
      logger: this.logger,
    });
    this.getMetricsExplorerMethod = createGetMetricsExplorer({
      clickhouse,
      logger: this.logger,
    });
  }

  async getTotalMetrics(
    input: z.input<typeof getTotalMetricsInputSchema>,
    context: { appId: string },
  ) {
    return this.getTotalMetricsMethod(input, context);
  }

  async getMetricsTrend(
    input: z.input<typeof getTotalMetricsInputSchema>,
    context: { appId: string },
  ) {
    return this.getMetricsTrendMethod(input, context);
  }

  async getMetricCatalog(
    input: z.input<typeof getMetricCatalogInputSchema>,
    context: { appId: string },
  ) {
    return this.getMetricCatalogMethod(input, context);
  }

  async getMetricsExplorer(
    input: z.input<typeof getMetricsExplorerInputSchema>,
    context: { appId: string },
  ) {
    return this.getMetricsExplorerMethod(input, context);
  }
}

export * from "./schema";
export { MetricsService };
