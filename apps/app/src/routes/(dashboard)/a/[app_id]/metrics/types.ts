import type { LogTimeFilter } from "../logs/types";

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
type MetricGroupBy = "none" | "metric" | "service" | "environment";
type MetricEntityKind = "application" | "host" | "container";

type MetricFilters = {
  search: string;
  metricName: string;
  services: string[];
  environments: string[];
  hosts: string[];
  containers: string[];
  entityKinds: MetricEntityKind[];
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
  hosts: number;
  containers: number;
  lastSeen: string;
  lastValue: number | null;
  isMonotonic: boolean;
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
  hostName: string;
  containerName: string;
  entityKind: string;
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
    hosts: MetricFacetOption[];
    containers: MetricFacetOption[];
    entityKinds: MetricFacetOption[];
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
  MetricEntityKind,
  MetricFacetOption,
  MetricFilters,
  MetricGroupBy,
  MetricSample,
  MetricSeries,
  MetricsExplorerResult,
};
