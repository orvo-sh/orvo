import { z } from "zod";

import { timeFilterSchema } from "../shared/time-filter";

const logTimePresetValues = [
  "last_30_minutes",
  "last_hour",
  "today",
  "last_4_hours",
  "last_24_hours",
  "last_3_days",
  "last_7_days",
  "last_2_weeks",
  "last_month",
] as const;

const logFilterOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "not_contains",
  "in",
  "not_in",
]);
const logSortBySchema = z.enum(["timestamp", "severity", "service"]);
const logSortOrderSchema = z.enum(["desc", "asc"]);

const logFilterConditionSchema = z.object({
  attribute: z.string().trim().min(1).max(255),
  operator: logFilterOperatorSchema,
  value: z.string().trim().min(1).max(500),
});

const logTimePresetSchema = z.enum(logTimePresetValues);

const logsQueryFiltersSchema = z.object({
  time: timeFilterSchema,
  activeFilters: z
    .array(logFilterConditionSchema)
    .max(50)
    .optional()
    .default([]),
});

const logsCursorSchema = z.string().trim().min(1).max(255);

const getLogsInputSchema = z.object({
  time: timeFilterSchema,
  activeFilters: z
    .array(logFilterConditionSchema)
    .max(50)
    .optional()
    .default([]),
  sortBy: logSortBySchema.default("timestamp"),
  sortOrder: logSortOrderSchema.default("desc"),
  limit: z.number().int().min(1).max(500).default(100),
  cursor: logsCursorSchema.optional(),
});

const getLogVolumeInputSchema = z.object({
  time: timeFilterSchema,
  activeFilters: z
    .array(logFilterConditionSchema)
    .max(50)
    .optional()
    .default([]),
  bucketCount: z.number().int().min(10).max(240).default(80),
});

const getLogServiceSummaryInputSchema = z.object({
  time: timeFilterSchema,
});

const getLogServiceVolumeInputSchema = z.object({
  time: timeFilterSchema,
  activeFilters: z
    .array(logFilterConditionSchema)
    .max(50)
    .optional()
    .default([]),
  bucketCount: z.number().int().min(5).max(240).default(20),
});

const getTotalLogsInputSchema = z.object({
  time: timeFilterSchema,
});

const getLogFilterValueSuggestionsInputSchema = z.object({
  attribute: z.string().trim().min(1).max(255),
  operator: logFilterOperatorSchema.optional(),
  query: z.string().trim().max(500).optional().default(""),
  limit: z.number().int().min(1).max(100).default(12),
});

const getLogByIdInputSchema = z.object({
  id: z.string().trim().min(1).max(255),
});

export {
  getLogByIdInputSchema,
  getLogsInputSchema,
  getLogFilterValueSuggestionsInputSchema,
  getLogServiceSummaryInputSchema,
  getLogServiceVolumeInputSchema,
  getLogVolumeInputSchema,
  getTotalLogsInputSchema,
  logFilterConditionSchema,
  logFilterOperatorSchema,
  logSortBySchema,
  logSortOrderSchema,
  logsCursorSchema,
  logsQueryFiltersSchema,
  logTimePresetSchema,
};
