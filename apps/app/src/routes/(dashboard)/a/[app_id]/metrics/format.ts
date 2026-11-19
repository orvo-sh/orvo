import { isUtilizationRatio } from "$lib/metric-definitions";
import { formatNumber } from "@repo/utils";
import type { MetricAggregation } from "./types";

const formatMetricValue = (
  value: number | null,
  unit = "",
  aggregation: MetricAggregation = "avg",
  metricName = "",
) => {
  if (value === null || !Number.isFinite(value)) {
    return "No data";
  }

  if (isUtilizationRatio(metricName, unit)) value *= 100;
  if (unit === "%" || isUtilizationRatio(metricName, unit)) {
    return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
  }

  if (unit === "By") {
    return formatBytes(value);
  }

  if (unit === "ms") {
    return formatDuration(value);
  }

  if (unit === "s") {
    return formatDuration(value * 1000);
  }

  const formatted =
    Math.abs(value) >= 1000
      ? formatNumber(value)
      : Number.isInteger(value)
        ? value.toString()
        : value.toFixed(Math.abs(value) < 10 ? 2 : 1);

  return aggregation === "count" || !unit || unit === "1"
    ? formatted
    : `${formatted} ${unit.replace(/[{}]/g, "")}`;
};

const formatBytes = (value: number) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDuration = (valueMs: number) => {
  if (valueMs < 1000) {
    return `${Math.round(valueMs)} ms`;
  }

  if (valueMs < 60_000) {
    return `${(valueMs / 1000).toFixed(valueMs >= 10_000 ? 0 : 1)} s`;
  }

  if (valueMs < 3_600_000) {
    return `${(valueMs / 60_000).toFixed(valueMs >= 600_000 ? 0 : 1)} min`;
  }

  return `${(valueMs / 3_600_000).toFixed(valueMs >= 36_000_000 ? 0 : 1)} hr`;
};

export { formatBytes, formatDuration, formatMetricValue };
