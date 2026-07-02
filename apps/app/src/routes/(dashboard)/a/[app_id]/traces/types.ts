import type {
  FilterBuilderAttribute,
  FilterBuilderFilter,
  FilterBuilderOperator,
} from "../_components/filter-builder";
import type { PageServerData } from "./$types";

type Span = PageServerData["traces"][number];

export type TraceSortBy =
  | "start_time"
  | "duration"
  | "span_count"
  | "trace_name";

export type TraceSortOrder = "desc" | "asc";


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

export type { Span };

