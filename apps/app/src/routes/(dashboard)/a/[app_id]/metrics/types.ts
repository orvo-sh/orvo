import type { LogTimeFilter } from "../logs/types";

type MetricAggregation = "avg" | "sum" | "min" | "max" | "count";
type MetricGroupBy = "none" | "metric" | "service" | "environment";

type MetricFilters = {
  search: string;
  metricName: string;
  services: string[];
  environments: string[];
};

type MetricFacetOption = {
  value: string;
  count: number;
};

type MetricCatalogItem = {
  name: string;
  type: string;
  unit: string;
  description: string;
  points: number;
  services: number;
  lastSeen: string;
  lastValue: number | null;
};

type MetricSeriesBucket = {
  startAtUtc: string;
  endAtUtc: string;
  value: number | null;
  points: number;
};

type MetricSeries = {
  name: string;
  points: number;
  buckets: MetricSeriesBucket[];
};

type MetricSample = {
  metricName: string;
  type: string;
  unit: string;
  serviceName: string;
  environment: string;
  time: string;
  value: number | null;
};

type MetricsExplorerResult = {
  summary: {
    totalPoints: number;
    metricCount: number;
    serviceCount: number;
    environmentCount: number;
    lastSeen: string | null;
  };
  facets: {
    metrics: MetricFacetOption[];
    services: MetricFacetOption[];
    environments: MetricFacetOption[];
  };
  catalog: MetricCatalogItem[];
  series: MetricSeries[];
  samples: MetricSample[];
  startAtUtc: string;
  endAtUtc: string;
};

export type {
  LogTimeFilter,
  MetricAggregation,
  MetricCatalogItem,
  MetricFacetOption,
  MetricFilters,
  MetricGroupBy,
  MetricSample,
  MetricSeries,
  MetricsExplorerResult,
};
