type LogTimePreset =
  | "last_hour"
  | "today"
  | "last_24_hours"
  | "last_3_days"
  | "last_7_days"
  | "last_2_weeks"
  | "last_month";

type LogTime =
  | {
      kind: "preset";
      preset: LogTimePreset;
    }
  | {
      kind: "range";
      start: Date;
      end: Date;
    };

type LogTimeFilter =
  | {
      kind: "preset";
      preset: LogTimePreset;
    }
  | {
      kind: "range";
      startAtUtc: string;
      endAtUtc: string;
    };

export type { LogTime, LogTimeFilter, LogTimePreset };

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
  trace_id: string;
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

export type LogFacetOption = {
  value: string;
  count: number;
};

export type LogFacets = {
  levels: LogFacetOption[];
  services: LogFacetOption[];
  environments: LogFacetOption[];
  scopes: LogFacetOption[];
  ingestionKeyIds: LogFacetOption[];
};

export type LogFilters = {
  search: string;
  levels: string[];
  services: string[];
  environments: string[];
  traceId: string;
};
