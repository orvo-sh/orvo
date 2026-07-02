import { z } from "zod";

import {
  buildInClause,
  normalizeDateTime,
  quote,
  toDateTime64,
} from "../shared/query-builders";
import { resolveTimeFilter } from "../shared/time-filter";
import {
  traceFilterConditionSchema,
  traceFilterOperatorSchema,
  tracesQueryFiltersSchema,
} from "./schema";

const traceStringOperators = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "in",
  "not_in",
] satisfies z.infer<typeof traceFilterOperatorSchema>[];

const traceDurationOperators = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
] satisfies z.infer<typeof traceFilterOperatorSchema>[];

const traceNumberOperators = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
] satisfies z.infer<typeof traceFilterOperatorSchema>[];

const traceStatusOperators = ["eq", "neq", "in", "not_in"] satisfies z.infer<
  typeof traceFilterOperatorSchema
>[];

const traceDurationSuggestionValues = [
  "10ms",
  "50ms",
  "100ms",
  "250ms",
  "500ms",
  "1s",
  "2s",
  "5s",
  "10s",
] as const;

const traceSearchBaseAttributes = [
  {
    key: "trace.id",
    label: "trace.id",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
    isCommon: true,
  },
  {
    key: "trace.name",
    label: "trace.name",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
    isCommon: true,
  },
  {
    key: "trace.status",
    label: "trace.status",
    source: "trace",
    type: "enum",
    availableOperators: traceStatusOperators,
    isCommon: true,
  },
  {
    key: "trace.duration",
    label: "trace.duration",
    source: "trace",
    type: "duration",
    availableOperators: traceDurationOperators,
  },
  {
    key: "trace.span_count",
    label: "trace.span_count",
    source: "trace",
    type: "number",
    availableOperators: traceNumberOperators,
  },
  {
    key: "service.name",
    label: "service.name",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
    isCommon: true,
  },
  {
    key: "deployment.environment",
    label: "deployment.environment",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
    isCommon: true,
  },
  {
    key: "scope.name",
    label: "scope.name",
    source: "scope",
    type: "string",
    availableOperators: traceStringOperators,
  },
  {
    key: "scope.version",
    label: "scope.version",
    source: "scope",
    type: "string",
    availableOperators: traceStringOperators,
  },
  {
    key: "status.message",
    label: "status.message",
    source: "span",
    type: "string",
    availableOperators: traceStringOperators,
  },
  {
    key: "ingestion_key_id",
    label: "ingestion_key_id",
    source: "trace",
    type: "string",
    availableOperators: traceStringOperators,
  },
] as const;

type RawServiceGraphEdgeRow = {
  source: string;
  target: string;
  total: number | string;
  errors: number | string;
};

type RawServiceGraphNodeRow = {
  service_name: string;
  total: number | string;
  errors: number | string;
  p95_latency_ms: number | string;
};

type RawTraceServiceSummaryRow = {
  service_name: string;
  total: number | string;
  errors: number | string;
  p95_latency_ms: number | string;
};

type RawTraceSummaryRow = {
  total: number | string;
  error_traces: number | string;
  p95_latency_ms: number | string;
  service_count: number | string;
};

type RawTraceMetricSummaryRow = {
  total: number | string;
  errors: number | string;
  p95_latency_ms: number | string;
};

type RawAttributeKeyRow = {
  key: string;
  count: number | string;
};

type RawFilterValueRow = {
  value: string;
  count: number | string;
};

type RawTraceRow = {
  id: string;
  trace_id: string;
  name: string;
  start_time: string | Date;
  end_time: string | Date;
  duration_ns: number | string;
  span_count: number | string;
  error_count: number | string;
  service_names: string[];
  deployment_environments: string[];
};

type RawSpanRow = {
  id: string;
  app_id: string;
  ingestion_key_id: string;
  received_at: string | Date;
  expires_at: string | Date;
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  trace_state: string;
  name: string;
  kind: number;
  start_time: string | Date;
  end_time: string | Date;
  duration_ns: number | string;
  status_code: number;
  status_message: string;
  resource_attributes: Record<string, string>;
  scope_attributes: Record<string, string>;
  span_attributes: Record<string, string>;
  resource_schema_url: string;
  scope_name: string;
  scope_version: string;
  scope_schema_url: string;
  events_json: string;
  links_json: string;
  service_name: string;
  deployment_environment: string;
};

const createDynamicTraceFilterAttribute = (
  source: "resource" | "scope" | "span",
  key: string,
) => ({
  key: `${source}.${key}`,
  label: `${source}.${key}`,
  source,
  type: "string" as const,
  availableOperators: traceStringOperators,
});

const resolveTraceFilterAttributeDefinition = (attribute: string) => {
  const staticAttribute = traceSearchBaseAttributes.find(
    (value) => value.key === attribute,
  );
  if (staticAttribute) {
    return {
      ...staticAttribute,
      kind:
        staticAttribute.key === "trace.status"
          ? ("enum" as const)
          : staticAttribute.key === "trace.duration"
            ? ("duration" as const)
            : staticAttribute.key === "trace.span_count"
              ? ("number" as const)
            : ("column" as const),
      column:
        staticAttribute.key === "trace.id"
          ? "trace_id"
          : staticAttribute.key === "trace.name"
            ? "name"
            : staticAttribute.key === "trace.span_count"
              ? "span_count"
            : staticAttribute.key === "service.name"
              ? "service_name"
              : staticAttribute.key === "deployment.environment"
                ? "deployment_environment"
                : staticAttribute.key === "scope.name"
                  ? "scope_name"
                  : staticAttribute.key === "scope.version"
                    ? "scope_version"
                    : staticAttribute.key === "status.message"
                      ? "status_message"
                      : staticAttribute.key === "ingestion_key_id"
                        ? "ingestion_key_id"
                        : undefined,
      scope:
        staticAttribute.key === "trace.id" ||
        staticAttribute.key === "trace.name" ||
        staticAttribute.key === "trace.status" ||
        staticAttribute.key === "trace.duration" ||
        staticAttribute.key === "trace.span_count"
          ? ("outer" as const)
          : ("inner" as const),
    };
  }

  if (attribute.startsWith("resource.")) {
    return {
      ...createDynamicTraceFilterAttribute("resource", attribute.slice(9)),
      mapColumn: "resource_attributes" as const,
      mapKey: attribute.slice(9),
      kind: "dynamic" as const,
      scope: "inner" as const,
    };
  }

  if (attribute.startsWith("scope.")) {
    if (attribute === "scope.name" || attribute === "scope.version") {
      return null;
    }

    return {
      ...createDynamicTraceFilterAttribute("scope", attribute.slice(6)),
      mapColumn: "scope_attributes" as const,
      mapKey: attribute.slice(6),
      kind: "dynamic" as const,
      scope: "inner" as const,
    };
  }

  if (attribute.startsWith("span.")) {
    if (attribute === "span.kind") {
      return null;
    }

    return {
      ...createDynamicTraceFilterAttribute("span", attribute.slice(5)),
      mapColumn: "span_attributes" as const,
      mapKey: attribute.slice(5),
      kind: "dynamic" as const,
      scope: "inner" as const,
    };
  }

  return null;
};

const parseDurationLiteralToNs = (value: string) => {
  const match = value.match(/^([\d.]+)\s*(ms|s|m|h|µs|us|ns)?$/i);
  if (!match) {
    return undefined;
  }

  const num = Number.parseFloat(match[1]);
  const unit = match[2]?.toLowerCase() ?? "ms";

  switch (unit) {
    case "ns":
      return num;
    case "µs":
    case "us":
      return num * 1_000;
    case "ms":
      return num * 1_000_000;
    case "s":
      return num * 1_000_000_000;
    case "m":
      return num * 60_000_000_000;
    case "h":
      return num * 3_600_000_000_000;
    default:
      return num * 1_000_000;
  }
};

const parseMultiValueLiteral = (value: string) =>
  value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumberLiteral = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildStringOperatorClause = (
  expression: string,
  operator: z.infer<typeof traceFilterOperatorSchema>,
  value: string,
) => {
  switch (operator) {
    case "eq":
      return `${expression} = ${quote(value)}`;
    case "neq":
      return `${expression} != ${quote(value)}`;
    case "contains":
      return `positionCaseInsensitiveUTF8(${expression}, ${quote(value)}) > 0`;
    case "not_contains":
      return `positionCaseInsensitiveUTF8(${expression}, ${quote(value)}) = 0`;
    case "in": {
      const values = parseMultiValueLiteral(value);
      if (values.length === 0) {
        return null;
      }

      return `${expression} IN (${values.map((item) => quote(item)).join(", ")})`;
    }
    case "not_in": {
      const values = parseMultiValueLiteral(value);
      if (values.length === 0) {
        return null;
      }

      return `${expression} NOT IN (${values.map((item) => quote(item)).join(", ")})`;
    }
    default:
      return null;
  }
};

const buildAnySearchClause = (value: string) =>
  `(positionCaseInsensitiveUTF8(name, ${quote(value)}) > 0 OR positionCaseInsensitiveUTF8(trace_id, ${quote(value)}) > 0 OR positionCaseInsensitiveUTF8(status_message, ${quote(value)}) > 0 OR positionCaseInsensitiveUTF8(service_name, ${quote(value)}) > 0 OR positionCaseInsensitiveUTF8(deployment_environment, ${quote(value)}) > 0)`;

const buildInnerConditionClause = (
  condition: z.infer<typeof traceFilterConditionSchema>,
) => {
  const definition = resolveTraceFilterAttributeDefinition(condition.attribute);
  if (!definition || definition.scope !== "inner") {
    return null;
  }

  if (definition.kind === "dynamic") {
    const expression = `toString(${definition.mapColumn}[${quote(definition.mapKey)}])`;
    const clause = buildStringOperatorClause(
      expression,
      condition.operator,
      condition.value,
    );
    if (!clause) {
      return null;
    }

    return `(mapContains(${definition.mapColumn}, ${quote(definition.mapKey)}) AND ${clause})`;
  }

  if (!definition.column) {
    return null;
  }

  return buildStringOperatorClause(
    definition.column,
    condition.operator,
    condition.value,
  );
};

const buildOuterConditionClause = (
  condition: z.infer<typeof traceFilterConditionSchema>,
) => {
  const definition = resolveTraceFilterAttributeDefinition(condition.attribute);
  if (!definition || definition.scope !== "outer") {
    return null;
  }

  if (definition.kind === "enum") {
    const values = parseMultiValueLiteral(condition.value).map((value) =>
      value.toLowerCase(),
    );
    const normalizedValues =
      values.length > 0 ? values : [condition.value.toLowerCase()];
    const validValues = normalizedValues.filter((value) =>
      ["ok", "error"].includes(value),
    );

    if (validValues.length === 0) {
      return null;
    }

    const includesError = validValues.includes("error");
    const includesOk = validValues.includes("ok");

    if (condition.operator === "eq") {
      return includesError ? "error_count > 0" : "error_count = 0";
    }
    if (condition.operator === "neq") {
      return includesError ? "error_count = 0" : "error_count > 0";
    }
    if (condition.operator === "in") {
      if (includesError && includesOk) {
        return "1 = 1";
      }

      return includesError ? "error_count > 0" : "error_count = 0";
    }
    if (condition.operator === "not_in") {
      if (includesError && includesOk) {
        return "1 = 0";
      }

      return includesError ? "error_count = 0" : "error_count > 0";
    }

    return null;
  }

  if (definition.kind === "duration") {
    const durationNs = parseDurationLiteralToNs(condition.value);
    if (durationNs === undefined) {
      return null;
    }

    switch (condition.operator) {
      case "eq":
        return `duration_ns = ${durationNs}`;
      case "neq":
        return `duration_ns != ${durationNs}`;
      case "gt":
        return `duration_ns > ${durationNs}`;
      case "gte":
        return `duration_ns >= ${durationNs}`;
      case "lt":
        return `duration_ns < ${durationNs}`;
      case "lte":
        return `duration_ns <= ${durationNs}`;
      default:
        return null;
    }
  }

  if (definition.kind === "number") {
    const numericValue = parseNumberLiteral(condition.value);
    if (numericValue === undefined || !definition.column) {
      return null;
    }

    switch (condition.operator) {
      case "eq":
        return `${definition.column} = ${numericValue}`;
      case "neq":
        return `${definition.column} != ${numericValue}`;
      case "gt":
        return `${definition.column} > ${numericValue}`;
      case "gte":
        return `${definition.column} >= ${numericValue}`;
      case "lt":
        return `${definition.column} < ${numericValue}`;
      case "lte":
        return `${definition.column} <= ${numericValue}`;
      default:
        return null;
    }
  }

  if (!definition.column) {
    return null;
  }

  return buildStringOperatorClause(
    definition.column,
    condition.operator,
    condition.value,
  );
};

const buildTraceFilterValueSuggestionsQuery = (
  definition: NonNullable<
    ReturnType<typeof resolveTraceFilterAttributeDefinition>
  >,
  appId: string,
  query: string,
  limit: number,
) => {
  const queryClause = query
    ? `AND positionCaseInsensitiveUTF8(value, ${quote(query)}) > 0`
    : "";

  if (definition.kind === "dynamic") {
    return `
      SELECT
        value,
        count() AS count
      FROM (
        SELECT toString(${definition.mapColumn}[${quote(definition.mapKey)}]) AS value
        FROM traces_raw
        WHERE app_id = ${quote(appId)}
          AND mapContains(${definition.mapColumn}, ${quote(definition.mapKey)})
      )
      WHERE value != ''
        ${queryClause}
      GROUP BY value
      ORDER BY count DESC, value ASC
      LIMIT ${limit}
    `;
  }

  if (definition.key === "trace.name") {
    return `
      SELECT
        value,
        count() AS count
      FROM (
        SELECT
          coalesce(nullIf(argMinIf(name, start_time, parent_span_id = ''), ''), argMin(name, start_time)) AS value
        FROM traces_raw
        WHERE app_id = ${quote(appId)}
        GROUP BY trace_id
      )
      WHERE value != ''
        ${queryClause}
      GROUP BY value
      ORDER BY count DESC, value ASC
      LIMIT ${limit}
    `;
  }

  if (definition.key === "trace.id") {
    return `
      SELECT
        value,
        count() AS count
      FROM (
        SELECT trace_id AS value
        FROM traces_raw
        WHERE app_id = ${quote(appId)}
        GROUP BY trace_id
      )
      WHERE value != ''
        ${queryClause}
      GROUP BY value
      ORDER BY value ASC
      LIMIT ${limit}
    `;
  }

  if (!("column" in definition) || !definition.column) {
    return `
      SELECT '' AS value, 0 AS count
      WHERE 1 = 0
    `;
  }

  return `
    SELECT
      value,
      count() AS count
    FROM (
      SELECT ${definition.column} AS value
      FROM traces_raw
      WHERE app_id = ${quote(appId)}
    )
    WHERE value != ''
      ${queryClause}
    GROUP BY value
    ORDER BY count DESC, value ASC
    LIMIT ${limit}
  `;
};

const buildTraceSummaryWhereClause = (
  appId: string,
  input: z.infer<typeof tracesQueryFiltersSchema>,
) => {
  const { startAtUtc, endAtUtc } = resolveTimeFilter(input.time);
  const whereClauses = [
    `app_id = ${quote(appId)}`,
    `start_time >= ${toDateTime64(startAtUtc)}`,
    `start_time <= ${toDateTime64(endAtUtc)}`,
  ];

  if (input.services.length > 0) {
    whereClauses.push(buildInClause("service_name", input.services));
  }

  if (input.environments.length > 0) {
    whereClauses.push(
      buildInClause("deployment_environment", input.environments),
    );
  }

  if (input.scopes.length > 0) {
    whereClauses.push(buildInClause("scope_name", input.scopes));
  }

  if (input.ingestionKeyIds.length > 0) {
    whereClauses.push(buildInClause("ingestion_key_id", input.ingestionKeyIds));
  }

  if (input.statusCodes.length > 0) {
    whereClauses.push(`status_code IN (${input.statusCodes.join(", ")})`);
  }

  return whereClauses.join(" AND ");
};

const buildWhereClause = (
  appId: string,
  input: z.infer<typeof tracesQueryFiltersSchema>,
) => {
  const { startAtUtc, endAtUtc } = resolveTimeFilter(input.time);
  const whereClauses = [
    `app_id = ${quote(appId)}`,
    `start_time >= ${toDateTime64(startAtUtc)}`,
    `start_time <= ${toDateTime64(endAtUtc)}`,
  ];

  if (input.search) {
    whereClauses.push(buildAnySearchClause(input.search));
  }

  if (input.services.length > 0) {
    whereClauses.push(buildInClause("service_name", input.services));
  }

  if (input.environments.length > 0) {
    whereClauses.push(
      buildInClause("deployment_environment", input.environments),
    );
  }

  if (input.scopes.length > 0) {
    whereClauses.push(buildInClause("scope_name", input.scopes));
  }

  if (input.ingestionKeyIds.length > 0) {
    whereClauses.push(buildInClause("ingestion_key_id", input.ingestionKeyIds));
  }

  if (input.statusCodes.length > 0) {
    whereClauses.push(`status_code IN (${input.statusCodes.join(", ")})`);
  }

  for (const condition of input.conditions) {
    const clause = buildInnerConditionClause(condition);
    if (clause) {
      whereClauses.push(clause);
    }
  }

  return whereClauses.join(" AND ");
};

export {
  buildOuterConditionClause,
  buildTraceFilterValueSuggestionsQuery,
  buildTraceSummaryWhereClause,
  buildWhereClause,
  createDynamicTraceFilterAttribute,
  resolveTraceFilterAttributeDefinition,
  traceDurationSuggestionValues,
  traceSearchBaseAttributes,
};
export { buildInClause, normalizeDateTime, quote, toDateTime64 };
export type {
  RawAttributeKeyRow,
  RawFilterValueRow,
  RawServiceGraphEdgeRow,
  RawServiceGraphNodeRow,
  RawSpanRow,
  RawTraceMetricSummaryRow,
  RawTraceRow,
  RawTraceServiceSummaryRow,
  RawTraceSummaryRow,
};
