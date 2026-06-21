import type { LogTimeFilter, LogTimePreset } from "../logs/types";
import type { MetricAggregation, MetricCatalogItem } from "./types";

const metricsTimePresets = [
  "last_hour",
  "today",
  "last_24_hours",
  "last_3_days",
  "last_7_days",
  "last_2_weeks",
  "last_month",
] satisfies LogTimePreset[];

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
] satisfies MetricAggregation[];

const createDefaultMetricsTimeFilter = (): LogTimeFilter => ({
  kind: "preset",
  preset: "last_hour",
});

const isMetricsTimePreset = (value: string): value is LogTimePreset =>
  metricsTimePresets.includes(value as LogTimePreset);

const isMetricAggregation = (value: string): value is MetricAggregation =>
  metricAggregationValues.includes(value as MetricAggregation);

const resolveMetricsStateFromSearchParams = (
  searchParams: URLSearchParams,
  fallbackTime = createDefaultMetricsTimeFilter(),
) => {
  const startAtUtc = searchParams.get("start");
  const endAtUtc = searchParams.get("end");
  const preset = searchParams.get("preset");
  const search = searchParams.get("q")?.trim() ?? "";
  const live = searchParams.get("live") === "1";
  const aggregation = searchParams.get("show");

  const time =
    startAtUtc &&
    endAtUtc &&
    !Number.isNaN(new Date(startAtUtc).getTime()) &&
    !Number.isNaN(new Date(endAtUtc).getTime())
      ? ({
          kind: "range",
          startAtUtc,
          endAtUtc,
        } as const)
      : preset && isMetricsTimePreset(preset)
        ? ({
            kind: "preset",
            preset,
          } as const)
        : fallbackTime;

  return {
    time,
    search,
    live,
    aggregation:
      aggregation && isMetricAggregation(aggregation) ? aggregation : null,
  };
};

const createMetricsStateSearchParams = (input: {
  time: LogTimeFilter;
  search: string;
  live: boolean;
  aggregation?: MetricAggregation | null;
}) => {
  const searchParams = new URLSearchParams();

  if (input.time.kind === "range") {
    searchParams.set("start", input.time.startAtUtc);
    searchParams.set("end", input.time.endAtUtc);
  } else {
    searchParams.set("preset", input.time.preset);
  }

  if (input.search.trim()) {
    searchParams.set("q", input.search.trim());
  }

  if (input.live) {
    searchParams.set("live", "1");
  }

  if (input.aggregation) {
    searchParams.set("show", input.aggregation);
  }

  return searchParams;
};

const resolveMetricsTimeRange = (time: LogTimeFilter) => {
  const now = new Date();

  if (time.kind === "range") {
    return {
      start: new Date(time.startAtUtc),
      end: new Date(time.endAtUtc),
    };
  }

  switch (time.preset) {
    case "last_hour":
      return { start: new Date(now.getTime() - 60 * 60 * 1000), end: now };
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    case "last_24_hours":
      return {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_3_days":
      return {
        start: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_7_days":
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_2_weeks":
      return {
        start: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_month":
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };
  }
};

const resolveMetricsBucketCount = (time: LogTimeFilter) => {
  const MIN_BUCKET_COUNT = 24;
  const MAX_BUCKET_COUNT = 120;
  const MINUTE_MS = 60_000;
  const HOUR_MS = 60 * MINUTE_MS;
  const DAY_MS = 24 * HOUR_MS;
  const autoBucketSizes = [
    { maxRangeMs: HOUR_MS, bucketSizeMs: MINUTE_MS },
    { maxRangeMs: 4 * HOUR_MS, bucketSizeMs: 2 * MINUTE_MS },
    { maxRangeMs: 12 * HOUR_MS, bucketSizeMs: 5 * MINUTE_MS },
    { maxRangeMs: DAY_MS, bucketSizeMs: 15 * MINUTE_MS },
    { maxRangeMs: 3 * DAY_MS, bucketSizeMs: 30 * MINUTE_MS },
    { maxRangeMs: 7 * DAY_MS, bucketSizeMs: 2 * HOUR_MS },
    { maxRangeMs: 30 * DAY_MS, bucketSizeMs: 12 * HOUR_MS },
  ] as const;
  const range = resolveMetricsTimeRange(time);
  const rangeMs = Math.max(range.end.getTime() - range.start.getTime(), 1);
  const bucketSizeMs =
    autoBucketSizes.find(({ maxRangeMs }) => rangeMs <= maxRangeMs)
      ?.bucketSizeMs ?? Math.ceil(rangeMs / 72);

  return Math.min(
    MAX_BUCKET_COUNT,
    Math.max(MIN_BUCKET_COUNT, Math.ceil(rangeMs / bucketSizeMs)),
  );
};

const resolveMetricAggregationOptions = (metric: MetricCatalogItem | null) => {
  if (!metric) {
    return [{ value: "avg", label: "avg" }] as const;
  }

  if (metric.type === "histogram") {
    return [
      { value: "p50", label: "p50" },
      { value: "p95", label: "p95" },
      { value: "p99", label: "p99" },
      { value: "avg", label: "avg" },
      { value: "max", label: "max" },
      { value: "count", label: "count" },
    ] as const;
  }

  if (metric.type === "sum" && metric.isMonotonic) {
    return [
      { value: "rate_per_sec", label: "rate/sec" },
      { value: "rate_per_min", label: "rate/min" },
      { value: "increase", label: "increase" },
      { value: "total", label: "total" },
    ] as const;
  }

  return [
    { value: "current", label: "current" },
    { value: "avg", label: "avg" },
    { value: "min", label: "min" },
    { value: "max", label: "max" },
  ] as const;
};

const resolveDefaultMetricAggregation = (metric: MetricCatalogItem) => {
  const normalizedName = metric.name.toLowerCase();

  if (metric.type === "histogram") {
    return "p95" satisfies MetricAggregation;
  }

  if (metric.type === "sum" && metric.isMonotonic) {
    if (normalizedName.includes("error") || normalizedName.includes("errors")) {
      return "rate_per_min" satisfies MetricAggregation;
    }

    return "rate_per_sec" satisfies MetricAggregation;
  }

  if (normalizedName.includes("memory")) {
    return "current" satisfies MetricAggregation;
  }

  if (normalizedName.includes("cpu")) {
    return "avg" satisfies MetricAggregation;
  }

  return metric.type === "gauge" ? "current" : "avg";
};

const encodeMetricName = (metricName: string) => encodeURIComponent(metricName);

const decodeMetricName = (metricName: string) => decodeURIComponent(metricName);

export {
  createDefaultMetricsTimeFilter,
  createMetricsStateSearchParams,
  decodeMetricName,
  encodeMetricName,
  resolveDefaultMetricAggregation,
  resolveMetricAggregationOptions,
  resolveMetricsBucketCount,
  resolveMetricsStateFromSearchParams,
};
