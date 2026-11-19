import { z } from "zod";

const alertIdSchema = z.string().trim().min(1);

const alertScopeArraySchema = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .default([]);

const alertScopeInputSchema = z.object({
  services: z
    .object({
      include: alertScopeArraySchema,
      exclude: alertScopeArraySchema,
    })
    .default({ include: [], exclude: [] }),
  spanNames: z
    .object({
      include: alertScopeArraySchema,
      exclude: alertScopeArraySchema,
    })
    .default({ include: [], exclude: [] }),
  environments: z
    .object({
      include: alertScopeArraySchema,
      exclude: alertScopeArraySchema,
    })
    .default({ include: [], exclude: [] }),
  scopes: z
    .object({
      include: alertScopeArraySchema,
      exclude: alertScopeArraySchema,
    })
    .default({ include: [], exclude: [] }),
  containerNames: z
    .object({
      include: alertScopeArraySchema,
      exclude: alertScopeArraySchema,
    })
    .default({ include: [], exclude: [] }),
});

const alertRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  metricType: z.string().max(32).nullable().default(null),
  metricIsMonotonic: z.boolean().default(false),
  metricName: z.string().trim().min(1).max(255).nullable().default(null),
  metricAggregation: z
    .enum([
      "avg",
      "min",
      "max",
      "current",
      "total",
      "increase",
      "rate_per_sec",
      "rate_per_min",
      "p50",
      "p95",
      "p99",
      "count",
    ])
    .nullable()
    .default(null),
  metricUnit: z.string().trim().max(255).nullable().default(null),
  metricAttributeFilters: z
    .record(
      z.string().trim().min(1).max(255),
      z.object({
        include: alertScopeArraySchema,
        exclude: alertScopeArraySchema,
      }),
    )
    .refine(
      (filters) => Object.keys(filters).length <= 20,
      "Choose at most 20 metric attributes.",
    )
    .default({}),
  comparator: z.enum(["gt", "gte", "lt", "lte"]),
  threshold: z.number().finite(),
  windowMinutes: z.number().int().min(1).max(1440),
  renotifyMinutes: z.number().int().min(1).max(10080).nullable().default(null),
  scope: alertScopeInputSchema,
  destinationIds: z.array(alertIdSchema).max(50).default([]),
});

const getAlertRuleInputSchema = alertIdSchema;
const createAlertRuleInputSchema = alertRuleInputSchema;
const updateAlertRuleInputSchema = alertRuleInputSchema.extend({
  id: alertIdSchema,
});
const setAlertRuleEnabledInputSchema = z.object({
  id: alertIdSchema,
  isEnabled: z.boolean(),
});
const deleteAlertRuleInputSchema = alertIdSchema;

export {
  alertIdSchema,
  alertRuleInputSchema,
  createAlertRuleInputSchema,
  deleteAlertRuleInputSchema,
  getAlertRuleInputSchema,
  setAlertRuleEnabledInputSchema,
  updateAlertRuleInputSchema,
};
