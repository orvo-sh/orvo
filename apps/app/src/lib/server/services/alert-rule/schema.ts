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
  signalType: z.enum([
    "error_rate",
    "latency_p95_ms",
    "latency_p99_ms",
    "apdex",
    "throughput_per_min",
    "availability_percent",
    "container_cpu_utilization",
    "container_memory_utilization",
    "container_reporting_stale",
  ]),
  comparator: z.enum(["gt", "gte", "lt", "lte"]),
  threshold: z.number().finite(),
  windowMinutes: z.number().int().min(1).max(1440),
  renotifyMinutes: z.number().int().min(1).max(10080).nullable().default(null),
  apdexTargetMs: z.number().int().min(1).max(600000).nullable().default(null),
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
