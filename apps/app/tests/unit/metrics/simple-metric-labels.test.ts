import { expect, test } from "vitest";
import {
  derivedMetrics,
  getMetricAggregationOptions,
} from "$lib/metric-definitions";
import { formatMetricValue } from "../../../src/routes/(dashboard)/a/[app_id]/metrics/format";
import {
  validateRuleConfig,
  defaultAlertRules,
} from "$lib/server/services/alert-rule/shared";
import { alertRuleInputSchema } from "$lib/server/services/alert-rule/schema";
import { createEmptyAlertRuleForm } from "$lib/alerts";

test("derived metrics use $ names and defaults contain complete metric conditions", () => {
  expect(derivedMetrics.map((metric) => metric.name)).toEqual([
    "$request.count",
    "$request.error_count",
    "$request.error_rate",
    "$request.duration",
  ]);
  for (const rule of defaultAlertRules) {
    const parsed = alertRuleInputSchema.parse({
      ...createEmptyAlertRuleForm(),
      ...rule,
    });
    expect(validateRuleConfig(parsed)).toBeNull();
  }
});

test("saving requires a metric and a supported aggregation", () => {
  const empty = alertRuleInputSchema.parse({
    ...createEmptyAlertRuleForm(),
    name: "Missing metric",
  });
  expect(validateRuleConfig(empty)).toContain("Choose a metric");
  const invalid = alertRuleInputSchema.parse({
    ...empty,
    metricName: "$request.error_rate",
    metricUnit: "%",
    metricAggregation: "p95",
  });
  expect(validateRuleConfig(invalid)).toContain("supported");
});

test("CPU ratios display as percentages while other dimensionless metrics stay numeric", () => {
  expect(formatMetricValue(0.8, "1", "avg", "container.cpu.utilization")).toBe(
    "80%",
  );
  expect(formatMetricValue(0.8, "1", "avg", "queue.depth")).toBe("0.80");
});

test("aggregation options follow each metric's supported calculations", () => {
  expect(
    getMetricAggregationOptions({
      name: "$request.count",
      type: "sum",
      isMonotonic: true,
    }).map((option) => option.value),
  ).toEqual(["total", "rate_per_sec", "rate_per_min"]);
  expect(
    getMetricAggregationOptions({ name: "$request.error_rate", type: "gauge" }),
  ).toEqual([{ value: "avg", label: "Average" }]);
});

test("error-rate thresholds accept the percentage boundaries and reject impossible values", () => {
  for (const threshold of [0, 0.1, 5, 100]) {
    const input = alertRuleInputSchema.parse({
      ...createEmptyAlertRuleForm(),
      ...defaultAlertRules[0],
      threshold,
    });
    expect(validateRuleConfig(input)).toBeNull();
  }
  for (const threshold of [-1, 100.01, 102102]) {
    const input = alertRuleInputSchema.parse({
      ...createEmptyAlertRuleForm(),
      ...defaultAlertRules[0],
      threshold,
    });
    expect(validateRuleConfig(input)).toContain("between 0 and 100%");
  }
});

test("nonnegative metrics allow large thresholds and custom gauges can be negative", () => {
  const cases = [
    {
      metricName: "$request.count",
      metricType: "sum",
      metricIsMonotonic: true,
      metricAggregation: "total",
      metricUnit: "{request}",
    },
    {
      metricName: "$request.duration",
      metricType: "histogram",
      metricAggregation: "p95",
      metricUnit: "ms",
    },
    {
      metricName: "container.cpu.utilization",
      metricType: "gauge",
      metricAggregation: "avg",
      metricUnit: "1",
    },
    {
      metricName: "payment.count",
      metricType: "sum",
      metricIsMonotonic: true,
      metricAggregation: "rate_per_sec",
      metricUnit: "1",
    },
    {
      metricName: "temperature",
      metricType: "histogram",
      metricAggregation: "count",
      metricUnit: "Cel",
    },
  ];
  for (const metric of cases) {
    const input = alertRuleInputSchema.parse({
      ...createEmptyAlertRuleForm(),
      ...metric,
      name: "Threshold",
      threshold: -1,
    });
    expect(validateRuleConfig(input)).toContain("0 or greater");
    expect(validateRuleConfig({ ...input, threshold: 102102 })).toBeNull();
  }
  const temperature = alertRuleInputSchema.parse({
    ...createEmptyAlertRuleForm(),
    name: "Freezing",
    metricName: "temperature",
    metricType: "gauge",
    metricAggregation: "current",
    metricUnit: "Cel",
    threshold: -10,
  });
  expect(validateRuleConfig(temperature)).toBeNull();
});
