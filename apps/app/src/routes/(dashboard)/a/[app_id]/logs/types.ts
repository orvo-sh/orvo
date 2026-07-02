import type { TimeFilter, TimeFilterPreset } from "$lib/core/time-filter";
import type { FilterBuilderAttribute } from "../_components/filter-builder";

type LogTime = TimeFilter extends infer T
  ? T extends { kind: "range"; start: string; end: string }
    ? { kind: "range"; start: Date; end: Date }
    : T
  : never;
type LogTimeFilter = TimeFilter;
type LogTimePreset = TimeFilterPreset;

export type { LogTime, LogTimeFilter, LogTimePreset };

export type LogSortBy = "timestamp" | "severity" | "service";
export type LogSortOrder = "desc" | "asc";

export type LogFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in";
export type LogFilterAttribute = FilterBuilderAttribute;
export type ActiveLogFilter = {
  attribute: string;
  operator: LogFilterOperator;
  value: string;
};

export type LogRecord = {
  id?: string;
  app_id?: string;
  ingestion_key_id?: string;
  received_at?: string;
  expires_at?: string;
  timestamp: string;
  observed_timestamp: string;
  severity_number: number;
  severity_text: string;
  body: string;
  trace_id?: string | null;
  span_id: string;
  trace_flags: number;
  resource_attributes: Record<string, string>;
  resource_schema_url: string;
  scope_name: string;
  scope_version: string;
  scope_attributes: Record<string, string>;
  scope_schema_url: string;
  log_attributes: Record<string, string>;
  service_name: string;
  deployment_environment: string;
};

export type LogVolumeBucket = {
  startAtUtc: string;
  endAtUtc: string;
  fatal: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
  trace: number;
  total: number;
};

export type LogCursor = string;

export type LogFilters = {
  activeFilters: ActiveLogFilter[];
};
