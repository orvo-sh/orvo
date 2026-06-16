import type {
  FilterBuilderAttribute,
  FilterBuilderFilter,
  FilterBuilderOperator,
} from "../_components/filter-builder";

export type TraceRow = {
  trace_id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_ns: number | string;
  span_count: number | string;
  error_count: number | string;
  service_names: string[];
  deployment_environments: string[];
};

export type SpanRow = {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  name: string;
  kind: number;
  start_time: string;
  end_time: string;
  duration_ns: number | string;
  status_code: number; // 0=unset, 1=ok, 2=error
  status_message: string;
  resource_attributes: Record<string, string>;
  scope_attributes: Record<string, string>;
  span_attributes: Record<string, string>;
  scope_name: string;
  scope_version: string;
  events_json: string;
  links_json: string;
  service_name: string;
  deployment_environment: string;
};

export type TraceFilterOperator = FilterBuilderOperator;
export type TraceFilterAttribute = FilterBuilderAttribute;

export type ActiveFilter = FilterBuilderFilter;

export type TraceFilters = {
  activeFilters: ActiveFilter[];
};

export type TraceFilterValueSuggestion = {
  value: string;
  count: number;
};
