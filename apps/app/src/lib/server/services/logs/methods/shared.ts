import { z } from "zod";

import {
  buildBoundInClause,
  type QueryBindings,
} from "../../shared/query-builders";
import { resolveTimeFilter } from "../../shared/time-filter";
import {
  logFilterConditionSchema,
  logFilterOperatorSchema,
  logsQueryFiltersSchema,
} from "../schema";

const logStringOperators = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "in",
  "not_in",
] satisfies z.infer<typeof logFilterOperatorSchema>[];

const logSearchBaseAttributes = [
  {
    key: "message",
    label: "message",
    source: "log",
    type: "string",
    availableOperators: logStringOperators,
    isCommon: true,
  },
  {
    key: "status",
    label: "status",
    source: "log",
    type: "string",
    availableOperators: logStringOperators,
    isCommon: true,
  },
  {
    key: "service",
    label: "service",
    source: "log",
    type: "string",
    availableOperators: logStringOperators,
    isCommon: true,
  },
  {
    key: "environment",
    label: "environment",
    source: "log",
    type: "string",
    availableOperators: logStringOperators,
    isCommon: true,
  },
  {
    key: "trace.id",
    label: "trace.id",
    source: "log",
    type: "string",
    availableOperators: logStringOperators,
    isCommon: true,
  },
  {
    key: "span.id",
    label: "span.id",
    source: "log",
    type: "string",
    availableOperators: logStringOperators,
  },
  {
    key: "scope.name",
    label: "scope.name",
    source: "scope",
    type: "string",
    availableOperators: logStringOperators,
  },
  {
    key: "scope.version",
    label: "scope.version",
    source: "scope",
    type: "string",
    availableOperators: logStringOperators,
  },
  {
    key: "ingestion_key_id",
    label: "ingestion_key_id",
    source: "log",
    type: "string",
    availableOperators: logStringOperators,
  },
] as const;

type RawAttributeKeyRow = {
  key: string;
  count: number | string;
};

type RawAttributeValueRow = {
  key: string;
  value: string;
};

type RawFilterValueRow = {
  value: string;
  count: number | string;
};

const createDynamicLogFilterAttribute = (
  source: "resource" | "scope" | "attribute",
  key: string,
) => ({
  key: `${source}.${key}`,
  label: `${source}.${key}`,
  source,
  type: "string" as const,
  availableOperators: logStringOperators,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

const collectNestedJsonAttributePaths = (
  value: unknown,
  path: string[] = [],
): string[] => {
  if (!isPlainObject(value)) {
    return path.length > 0 ? [path.join(".")] : [];
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return path.length > 0 ? [path.join(".")] : [];
  }

  return entries.flatMap(([key, childValue]) =>
    collectNestedJsonAttributePaths(childValue, [...path, key]),
  );
};

const collectLogJsonFilterAttributes = (rows: RawAttributeValueRow[]) => {
  const keys = new Set<string>();

  for (const row of rows) {
    const trimmed = row.value.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed);
      for (const path of collectNestedJsonAttributePaths(parsed)) {
        keys.add(`attribute.${row.key}.${path}`);
      }
    } catch {
      continue;
    }
  }

  return Array.from(keys)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => createDynamicLogFilterAttribute("attribute", key.slice(10)));
};

const normalizeJsonExtractExpression = (expression: string) =>
  `replaceRegexpAll(${expression}, '^"|"$', '')`;

const buildDynamicLogAttributeExpression = (
  bindings: QueryBindings,
  definition: {
    mapColumn: "resource_attributes" | "scope_attributes" | "log_attributes";
    mapKey: string;
    jsonPath?: string[];
  },
) => {
  const baseExpression = `toString(${definition.mapColumn}[${bindings.bindString("map_key", definition.mapKey)}])`;

  if (!definition.jsonPath || definition.jsonPath.length === 0) {
    return baseExpression;
  }

  return normalizeJsonExtractExpression(
    `JSONExtractRaw(${baseExpression}, ${definition.jsonPath
      .map((segment) => bindings.bindString("json_path", segment))
      .join(", ")})`,
  );
};

const resolveLogFilterAttributeDefinition = (attribute: string) => {
  const staticAttribute = logSearchBaseAttributes.find(
    (value) => value.key === attribute,
  );
  if (staticAttribute) {
    return {
      ...staticAttribute,
      kind: "column" as const,
      column:
        staticAttribute.key === "message"
          ? "body"
          : staticAttribute.key === "status"
            ? "severity_text"
            : staticAttribute.key === "service"
              ? "service_name"
              : staticAttribute.key === "environment"
                ? "deployment_environment"
                : staticAttribute.key === "trace.id"
                  ? "trace_id"
                  : staticAttribute.key === "span.id"
                    ? "span_id"
                    : staticAttribute.key === "scope.name"
                      ? "scope_name"
                      : staticAttribute.key === "scope.version"
                        ? "scope_version"
                        : staticAttribute.key === "ingestion_key_id"
                          ? "ingestion_key_id"
                          : undefined,
    };
  }

  if (attribute.startsWith("resource.")) {
    return {
      ...createDynamicLogFilterAttribute("resource", attribute.slice(9)),
      mapColumn: "resource_attributes" as const,
      mapKey: attribute.slice(9),
      kind: "dynamic" as const,
    };
  }

  if (attribute.startsWith("scope.")) {
    return {
      ...createDynamicLogFilterAttribute("scope", attribute.slice(6)),
      mapColumn: "scope_attributes" as const,
      mapKey: attribute.slice(6),
      kind: "dynamic" as const,
    };
  }

  if (attribute.startsWith("attribute.")) {
    const segments = attribute.slice(10).split(".").filter(Boolean);
    const [mapKey, ...jsonPath] = segments;
    if (!mapKey) {
      return null;
    }

    return {
      ...createDynamicLogFilterAttribute("attribute", segments.join(".")),
      mapColumn: "log_attributes" as const,
      mapKey,
      jsonPath,
      kind: "dynamic" as const,
    };
  }

  if (attribute.startsWith("log.")) {
    const segments = attribute.slice(4).split(".").filter(Boolean);
    const [mapKey, ...jsonPath] = segments;
    if (!mapKey) {
      return null;
    }

    return {
      ...createDynamicLogFilterAttribute("attribute", segments.join(".")),
      mapColumn: "log_attributes" as const,
      mapKey,
      jsonPath,
      kind: "dynamic" as const,
    };
  }

  return null;
};

const parseMultiValueLiteral = (value: string) =>
  value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

const buildStringOperatorClause = (
  bindings: QueryBindings,
  expression: string,
  operator: z.infer<typeof logFilterOperatorSchema>,
  value: string,
) => {
  switch (operator) {
    case "eq":
      return `${expression} = ${bindings.bindString("filter_value", value)}`;
    case "neq":
      return `${expression} != ${bindings.bindString("filter_value", value)}`;
    case "contains":
      return `positionCaseInsensitiveUTF8(${expression}, ${bindings.bindString("filter_value", value)}) > 0`;
    case "not_contains":
      return `positionCaseInsensitiveUTF8(${expression}, ${bindings.bindString("filter_value", value)}) = 0`;
    case "in": {
      const values = parseMultiValueLiteral(value);
      if (values.length === 0) {
        return null;
      }

      return buildBoundInClause(
        expression,
        values,
        bindings.bindString,
        "filter_value",
      );
    }
    case "not_in": {
      const values = parseMultiValueLiteral(value);
      if (values.length === 0) {
        return null;
      }

      return buildBoundInClause(
        expression,
        values,
        bindings.bindString,
        "filter_value",
        "NOT IN",
      );
    }
  }
};

const buildLogActiveFilterClause = (
  bindings: QueryBindings,
  condition: z.infer<typeof logFilterConditionSchema>,
) => {
  const definition = resolveLogFilterAttributeDefinition(condition.attribute);
  if (!definition) {
    return null;
  }

  if (definition.kind === "dynamic") {
    const expression = buildDynamicLogAttributeExpression(bindings, definition);
    const clause = buildStringOperatorClause(
      bindings,
      expression,
      condition.operator,
      condition.value,
    );
    if (!clause) {
      return null;
    }

    return `(mapContains(${definition.mapColumn}, ${bindings.bindString("map_key", definition.mapKey)}) AND ${clause})`;
  }

  if (!definition.column) {
    return null;
  }

  return buildStringOperatorClause(
    bindings,
    definition.column,
    condition.operator,
    condition.value,
  );
};

const buildLogFilterValueSuggestionsQuery = (
  bindings: QueryBindings,
  definition: NonNullable<
    ReturnType<typeof resolveLogFilterAttributeDefinition>
  >,
  appId: string,
  query: string,
  limit: number,
) => {
  const queryClause = query
    ? `AND positionCaseInsensitiveUTF8(value, ${bindings.bindString("query", query)}) > 0`
    : "";

  if (definition.kind === "dynamic") {
    const expression = buildDynamicLogAttributeExpression(bindings, definition);

    return `
      SELECT
        value,
        count() AS count
      FROM (
        SELECT ${expression} AS value
        FROM logs_raw
        WHERE app_id = ${bindings.bindString("app_id", appId)}
          AND mapContains(${definition.mapColumn}, ${bindings.bindString("map_key", definition.mapKey)})
      )
      WHERE value != ''
        ${queryClause}
      GROUP BY value
      ORDER BY count DESC, value ASC
      LIMIT ${bindings.bindUInt32("limit", limit)}
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
      FROM logs_raw
      WHERE app_id = ${bindings.bindString("app_id", appId)}
    )
    WHERE value != ''
      ${queryClause}
    GROUP BY value
    ORDER BY count DESC, value ASC
    LIMIT ${bindings.bindUInt32("limit", limit)}
  `;
};

const buildWhereClause = (
  bindings: QueryBindings,
  appId: string,
  input: z.infer<typeof logsQueryFiltersSchema>,
) => {
  const { startAtUtc, endAtUtc } = resolveTimeFilter(input.time);
  const whereClauses = [
    `app_id = ${bindings.bindString("app_id", appId)}`,
    `timestamp >= ${bindings.bindDateTime64("start_at", startAtUtc)}`,
    `timestamp <= ${bindings.bindDateTime64("end_at", endAtUtc)}`,
  ];

  for (const condition of input.activeFilters) {
    const clause = buildLogActiveFilterClause(bindings, condition);
    if (clause) {
      whereClauses.push(clause);
    }
  }

  return whereClauses.join(" AND ");
};

export {
  buildDynamicLogAttributeExpression,
  buildLogFilterValueSuggestionsQuery,
  buildWhereClause,
  collectLogJsonFilterAttributes,
  createDynamicLogFilterAttribute,
  logSearchBaseAttributes,
  resolveLogFilterAttributeDefinition,
  type RawAttributeKeyRow,
  type RawAttributeValueRow,
  type RawFilterValueRow,
};
