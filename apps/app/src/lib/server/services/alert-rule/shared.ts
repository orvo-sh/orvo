import {
  getMetricAggregationOptions,
  getMetricThresholdError,
} from "$lib/metric-definitions";
import { z } from "zod";
import { alertRuleInputSchema } from "./schema";

const validateRuleConfig = (input: z.infer<typeof alertRuleInputSchema>) => {
  if (
    !input.metricName ||
    !input.metricAggregation ||
    input.metricUnit === null
  )
    return "Choose a metric and an aggregation.";
  if (
    !getMetricAggregationOptions({
      name: input.metricName,
      type: input.metricType ?? "gauge",
      isMonotonic: input.metricIsMonotonic,
    }).some((option) => option.value === input.metricAggregation)
  )
    return "Choose an aggregation supported by this metric.";
  return getMetricThresholdError(
    {
      name: input.metricName,
      type: input.metricType,
      unit: input.metricUnit,
      isMonotonic: input.metricIsMonotonic,
      aggregation: input.metricAggregation,
    },
    input.threshold,
  );
};

const uniqueValues = (values: string[]) => Array.from(new Set(values));

const defaultAlertRules = [
  {
    name: "High error rate",
    metricName: "$request.error_rate",
    metricType: "gauge",
    metricAggregation: "avg",
    metricUnit: "%",
    metricIsMonotonic: false,
    comparator: "gt",
    threshold: 5,
    windowMinutes: 5,
    renotifyMinutes: 15,
  },
  {
    name: "Slow requests",
    metricName: "$request.duration",
    metricType: "histogram",
    metricAggregation: "p95",
    metricUnit: "ms",
    metricIsMonotonic: false,
    comparator: "gt",
    threshold: 1000,
    windowMinutes: 15,
    renotifyMinutes: 30,
  },
] as const;

export { defaultAlertRules, uniqueValues, validateRuleConfig };
