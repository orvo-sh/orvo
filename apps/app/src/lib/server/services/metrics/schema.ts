import { z } from "zod";

import { timeFilterSchema } from "../shared/time-filter";

const metricAggregationValues = [
  "p50",
  "p95",
  "p99",
  "avg",
  "min",
  "max",
  "count",
  "rate_per_sec",
  "rate_per_min",
  "increase",
  "total",
  "current",
] as const;
const metricGroupByValues = [
  "none",
  "metric",
  "service",
  "environment",
] as const;
const metricEntityKindValues = ["application", "host", "container"] as const;

const stringArrayFilterSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .default([]);

const metricAggregationSchema = z.enum(metricAggregationValues);
const metricGroupBySchema = z.enum(metricGroupByValues);
const metricEntityKindSchema = z.enum(metricEntityKindValues);

const metricsQueryFiltersSchema = z.object({
  time: timeFilterSchema,
  metricName: z.string().trim().min(1).max(255).optional(),
  search: z.string().trim().max(500).optional().default(""),
  aggregation: metricAggregationSchema.default("avg"),
  groupBy: metricGroupBySchema.default("none"),
  services: stringArrayFilterSchema.optional().default([]),
  environments: stringArrayFilterSchema.optional().default([]),
  hosts: stringArrayFilterSchema.optional().default([]),
  containers: stringArrayFilterSchema.optional().default([]),
  entityKinds: z.array(metricEntityKindSchema).max(10).default([]),
});

const getMetricCatalogInputSchema = z.object({
  time: timeFilterSchema,
  search: z.string().trim().max(500).optional().default(""),
  limit: z.number().int().min(1).max(250).default(100),
});

const getMetricsExplorerInputSchema = metricsQueryFiltersSchema.extend({
  bucketCount: z.number().int().min(10).max(240).default(80),
  sampleLimit: z.number().int().min(1).max(100).default(50),
});

const getTotalMetricsInputSchema = z.object({
  time: timeFilterSchema,
});

export {
  getMetricCatalogInputSchema,
  getMetricsExplorerInputSchema,
  getTotalMetricsInputSchema,
  metricAggregationSchema,
  metricGroupBySchema,
  metricsQueryFiltersSchema,
};
