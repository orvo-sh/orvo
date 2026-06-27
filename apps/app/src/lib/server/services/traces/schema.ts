import { z } from "zod";

import { timeFilterSchema } from "../shared/time-filter";

const stringArrayFilterSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .default([]);

const statusCodeFilterSchema = z
  .array(z.number().int().min(0).max(255))
  .max(10)
  .default([]);

const traceStatusFilterSchema = z
  .array(z.enum(["ok", "error"]))
  .max(10)
  .default([]);

const traceFilterOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "not_contains",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
]);

const traceFilterConditionSchema = z.object({
  attribute: z.string().trim().min(1).max(255),
  operator: traceFilterOperatorSchema,
  value: z.string().trim().min(1).max(2000),
});

const tracesCursorSchema = z.object({
  startTime: z.string().datetime({ offset: true }),
  traceId: z.string().trim().min(1).max(255),
});

const tracesQueryFiltersSchema = z.object({
  time: timeFilterSchema,
  search: z.string().trim().max(500).optional().default(""),
  services: stringArrayFilterSchema.optional().default([]),
  environments: stringArrayFilterSchema.optional().default([]),
  scopes: stringArrayFilterSchema.optional().default([]),
  ingestionKeyIds: stringArrayFilterSchema.optional().default([]),
  statusCodes: statusCodeFilterSchema.optional().default([]),
  statuses: traceStatusFilterSchema.optional().default([]),
  operations: stringArrayFilterSchema.optional().default([]),
  traceIds: stringArrayFilterSchema.optional().default([]),
  conditions: z.array(traceFilterConditionSchema).max(50).optional().default([]),
  minDurationNs: z.number().min(0).optional(),
  maxDurationNs: z.number().min(0).optional(),
});

const getTracesInputSchema = tracesQueryFiltersSchema.extend({
  limit: z.number().int().min(1).max(500).default(100),
  cursor: tracesCursorSchema.optional(),
});

const getTraceInputSchema = z.object({
  traceId: z.string().trim().min(1).max(255),
});

const getTraceSummaryInputSchema = tracesQueryFiltersSchema;

const getTotalTracesInputSchema = z.object({
  time: timeFilterSchema,
});

const getTraceServiceSummaryInputSchema = z.object({
  time: timeFilterSchema,
});

const getTraceMetricsInputSchema = z.object({
  time: timeFilterSchema,
  bucketCount: z.number().int().min(10).max(240).default(60),
});

const getServiceGraphInputSchema = z.object({
  time: timeFilterSchema,
});

const getTraceFilterValueSuggestionsInputSchema = z.object({
  attribute: z.string().trim().min(1).max(255),
  operator: traceFilterOperatorSchema.optional(),
  query: z.string().trim().max(500).optional().default(""),
  limit: z.number().int().min(1).max(100).default(12),
});

export {
  getServiceGraphInputSchema,
  getTotalTracesInputSchema,
  getTraceFilterValueSuggestionsInputSchema,
  getTraceInputSchema,
  getTraceMetricsInputSchema,
  getTraceServiceSummaryInputSchema,
  getTraceSummaryInputSchema,
  getTracesInputSchema,
  traceFilterConditionSchema,
  traceFilterOperatorSchema,
  tracesCursorSchema,
  tracesQueryFiltersSchema,
};
