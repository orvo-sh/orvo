const derivedMetrics = [
  {
    name: "$request.count",
    type: "sum",
    unit: "{request}",
    description: "Number of incoming requests.",
    isMonotonic: true,
    aggregation: "total",
    aggregations: ["total", "rate_per_sec", "rate_per_min"],
  },
  {
    name: "$request.error_count",
    type: "sum",
    unit: "{error}",
    description: "Number of failed incoming requests.",
    isMonotonic: true,
    aggregation: "total",
    aggregations: ["total", "rate_per_sec", "rate_per_min"],
  },
  {
    name: "$request.error_rate",
    type: "gauge",
    unit: "%",
    description:
      "Failed incoming requests as a percentage of observed incoming requests.",
    isMonotonic: false,
    aggregation: "avg",
    aggregations: ["avg"],
  },
  {
    name: "$request.duration",
    type: "histogram",
    unit: "ms",
    description: "Duration of incoming requests.",
    isMonotonic: false,
    aggregation: "p95",
    aggregations: ["p50", "p95", "p99", "avg", "min", "max", "count"],
  },
] as const;

type MetricAggregation =
  | "p50"
  | "p95"
  | "p99"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "rate_per_sec"
  | "rate_per_min"
  | "increase"
  | "total"
  | "current";

const getMetricAggregationOptions = (metric: {
  name: string;
  type: string;
  isMonotonic?: boolean;
}) => {
  const derived = derivedMetrics.find((item) => item.name === metric.name);
  const values: readonly MetricAggregation[] =
    derived?.aggregations ??
    (metric.type === "histogram"
      ? ["p50", "p95", "p99", "avg", "count"]
      : metric.type === "sum" && metric.isMonotonic
        ? ["increase", "rate_per_sec", "rate_per_min", "total"]
        : ["current", "avg", "min", "max"]);
  const labels: Record<MetricAggregation, string> = {
    p50: "Median (p50)",
    p95: "95th percentile (p95)",
    p99: "99th percentile (p99)",
    avg: "Average",
    min: "Lowest",
    max: "Highest",
    count: "Count",
    rate_per_sec: "Events per second",
    rate_per_min: "Events per minute",
    increase: "New events",
    total: "Total",
    current: "Latest",
  };
  return values.map((value) => ({ value, label: labels[value] }));
};

const getDefaultMetricAggregation = (metric: {
  name: string;
  type: string;
  isMonotonic?: boolean;
}): MetricAggregation =>
  derivedMetrics.find((item) => item.name === metric.name)?.aggregation ??
  (metric.type === "histogram"
    ? "p95"
    : metric.type === "sum" && metric.isMonotonic
      ? "rate_per_sec"
      : "current");

const isUtilizationRatio = (
  name: string | null | undefined,
  unit: string | null | undefined,
) =>
  unit === "1" &&
  !!name &&
  (name.endsWith(".utilization") || name.endsWith(".usage_ratio"));

const getMetricThresholdBounds = (metric: {
  name: string | null;
  type?: string | null;
  unit?: string | null;
  isMonotonic?: boolean;
  aggregation?: string | null;
}): { min?: number; max?: number } => {
  if (metric.name === "$request.error_rate") return { min: 0, max: 100 };
  if (
    derivedMetrics.some((item) => item.name === metric.name) ||
    metric.aggregation === "count" ||
    (metric.type === "sum" && metric.isMonotonic) ||
    isUtilizationRatio(metric.name, metric.unit)
  )
    return { min: 0 };
  return {};
};

const getMetricThresholdError = (
  metric: Parameters<typeof getMetricThresholdBounds>[0],
  threshold: number,
) => {
  if (!Number.isFinite(threshold)) return "Enter a valid threshold.";
  const bounds = getMetricThresholdBounds(metric);
  if (
    bounds.max !== undefined &&
    (threshold < (bounds.min ?? -Infinity) || threshold > bounds.max)
  )
    return `Threshold must be between ${bounds.min} and ${bounds.max}%.`;
  if (bounds.min !== undefined && threshold < bounds.min)
    return `Threshold must be ${bounds.min} or greater.`;
  return null;
};

export {
  derivedMetrics,
  getMetricThresholdBounds,
  getMetricThresholdError,
  isUtilizationRatio,
  getMetricAggregationOptions,
  getDefaultMetricAggregation,
};
export type { MetricAggregation };
