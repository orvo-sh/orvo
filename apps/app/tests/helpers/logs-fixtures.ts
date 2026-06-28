import type { ClickHouse } from "@repo/clickhouse";
import { genId } from "@repo/utils";

type LogRow = {
  id: string;
  app_id: string;
  ingestion_key_id: string;
  received_at: string;
  expires_at: string;
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

type BuildLogOverrides = Partial<LogRow> & {
  resource_attributes?: Record<string, string>;
  scope_attributes?: Record<string, string>;
  log_attributes?: Record<string, string>;
};

const toClickHouseDateTime = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 23)}`;
};

const buildLog = (overrides: BuildLogOverrides = {}): LogRow => {
  const timestamp = overrides.timestamp ?? new Date().toISOString();
  const receivedAt = overrides.received_at ?? timestamp;

  return {
    id: overrides.id ?? genId("log"),
    app_id: overrides.app_id ?? "test-app-id",
    ingestion_key_id: overrides.ingestion_key_id ?? "test-ingestion-key-id",
    received_at: toClickHouseDateTime(receivedAt),
    expires_at: toClickHouseDateTime(
      overrides.expires_at ??
        new Date(new Date(receivedAt).getTime() + 30 * 24 * 60 * 60 * 1000),
    ),
    timestamp: toClickHouseDateTime(timestamp),
    observed_timestamp: toClickHouseDateTime(
      overrides.observed_timestamp ?? timestamp,
    ),
    severity_number: overrides.severity_number ?? 9,
    severity_text: overrides.severity_text ?? "info",
    body: overrides.body ?? "test log message",
    trace_id: overrides.trace_id ?? "",
    span_id: overrides.span_id ?? "",
    trace_flags: overrides.trace_flags ?? 0,
    resource_attributes: overrides.resource_attributes ?? {},
    resource_schema_url: overrides.resource_schema_url ?? "",
    scope_name: overrides.scope_name ?? "",
    scope_version: overrides.scope_version ?? "",
    scope_attributes: overrides.scope_attributes ?? {},
    scope_schema_url: overrides.scope_schema_url ?? "",
    log_attributes: overrides.log_attributes ?? {},
    service_name: overrides.service_name ?? "test-service",
    deployment_environment: overrides.deployment_environment ?? "production",
  };
};

const buildLogs = (
  count: number,
  overridesFactory:
    | BuildLogOverrides
    | ((index: number) => BuildLogOverrides) = {},
): LogRow[] =>
  Array.from({ length: count }, (_, index) =>
    buildLog(
      typeof overridesFactory === "function"
        ? overridesFactory(index)
        : overridesFactory,
    ),
  );

const insertLogs = async (clickhouse: ClickHouse, rows: LogRow | LogRow[]) => {
  const values = Array.isArray(rows) ? rows : [rows];
  if (values.length === 0) {
    return;
  }

  await clickhouse.insert({
    table: "logs_raw",
    values,
    format: "JSONEachRow",
  });
};

export { buildLog, buildLogs, insertLogs, type LogRow };
