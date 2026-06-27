import type { LogRecord } from "../types";

type LogAttributeChip = {
  key: string;
  value: string;
  fullValue?: string;
};

const MAX_PREVIEW_LENGTH = 48;
const HIDDEN_ROW_CHIP_KEYS = new Set([
  "resource.service.name",
  "resource.service.namespace",
  "resource.service.instance.id",
  "resource.deployment.environment",
  "resource.telemetry.sdk.name",
  "resource.telemetry.sdk.language",
  "resource.telemetry.sdk.version",
  "resource.telemetry.auto.version",
  "resource.otel.scope.name",
  "resource.otel.scope.version",
  "scope.telemetry.sdk.name",
  "scope.telemetry.sdk.language",
  "scope.telemetry.sdk.version",
  "scope.otel.scope.name",
  "scope.otel.scope.version",
  "log.otel.severity_number",
  "log.otel.severity_text",
]);
const HIDDEN_ROW_CHIP_PREFIXES = [
  "resource.process.",
  "resource.os.",
  "resource.host.",
  "resource.container.",
  "resource.k8s.",
];

const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

const formatPrimitiveValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (value === null) {
    return "null";
  }

  return String(value);
};

const formatJsonValue = (value: unknown) => JSON.stringify(value, null, 2);

const truncatePreview = (value: string, maxLength = MAX_PREVIEW_LENGTH) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;

const normalizeBodyPrefix = (value: string) =>
  value
    .trim()
    .replace(/[:=\-]+$/, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^\.+|\.+$/g, "");

const tryParseBodyJsonObject = (candidate: string, prefix = "") => {
  try {
    const parsed = JSON.parse(candidate);

    if (!isPlainObject(parsed)) {
      return null;
    }

    return {
      parsed,
      prefix: normalizeBodyPrefix(prefix),
    };
  } catch {
    return null;
  }
};

const findJsonObjectEnd = (value: string, startIndex: number) => {
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
};

const extractBodyJsonObjects = (body: string) => {
  const trimmed = body.trim();
  if (!trimmed) {
    return [];
  }

  const directMatch = tryParseBodyJsonObject(trimmed);
  if (directMatch) {
    return [directMatch];
  }

  const extractedMatches: Array<{
    parsed: Record<string, unknown>;
    prefix: string;
  }> = [];
  let searchStart = 0;

  while (searchStart < trimmed.length) {
    const jsonStart = trimmed.indexOf("{", searchStart);
    if (jsonStart === -1) {
      break;
    }

    const jsonEnd = findJsonObjectEnd(trimmed, jsonStart);
    if (jsonEnd === -1) {
      break;
    }

    const prefix = trimmed.slice(searchStart, jsonStart);
    const candidate = trimmed.slice(jsonStart, jsonEnd + 1);
    const parsed = tryParseBodyJsonObject(candidate, prefix);

    if (parsed) {
      extractedMatches.push(parsed);
    }

    searchStart = jsonEnd + 1;
  }

  return extractedMatches;
};

const createNestedChip = (key: string, value: unknown): LogAttributeChip => {
  if (isPlainObject(value) || Array.isArray(value)) {
    const formattedValue = formatJsonValue(value);

    return {
      key,
      value: truncatePreview(formattedValue.replace(/\s+/g, " ")),
      fullValue: formattedValue,
    };
  }

  return {
    key,
    value: formatPrimitiveValue(value),
  };
};

const flattenAttributeValueToChips = (
  key: string,
  value: unknown,
): LogAttributeChip[] => {
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [createNestedChip(key, value)];
    }

    return entries.flatMap(([childKey, childValue]) =>
      flattenAttributeValueToChips(`${key}.${childKey}`, childValue),
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [createNestedChip(key, value)];
    }

    return value.flatMap((item, index) =>
      flattenAttributeValueToChips(`${key}[${index}]`, item),
    );
  }

  return [createNestedChip(key, value)];
};

const buildBodyAttributeChips = (body: string): LogAttributeChip[] => {
  if (!body.trim()) {
    return [];
  }

  try {
    const extracted = extractBodyJsonObjects(body);

    if (extracted.length === 0) {
      return [];
    }

    return extracted.flatMap(({ parsed, prefix }) =>
      Object.entries(parsed).flatMap(([key, value]) =>
        flattenAttributeValueToChips(
          prefix ? `${prefix}.${key}` : key,
          value,
        ),
      ),
    );
  } catch {
    return [];
  }
};

const mapAttributeEntriesToChips = (
  attributes: Record<string, string> | undefined,
  prefix?: string,
) =>
  Object.entries(attributes ?? {}).map(([key, value]) => ({
    key: prefix ? `${prefix}.${key}` : key,
    value,
  }));

const shouldRenderRowChip = (key: string) =>
  !HIDDEN_ROW_CHIP_KEYS.has(key) &&
  !HIDDEN_ROW_CHIP_PREFIXES.some((prefix) => key.startsWith(prefix));

const buildLogAttributeChips = (log: LogRecord) => [
  ...buildBodyAttributeChips(log.body),
  ...mapAttributeEntriesToChips(log.log_attributes),
  ...mapAttributeEntriesToChips(log.resource_attributes, "resource"),
  ...mapAttributeEntriesToChips(log.scope_attributes, "scope"),
].filter((chip) => shouldRenderRowChip(chip.key));

const formatLogBodyForDisplay = (body: string) => {
  if (!body.trim()) {
    return "(empty body)";
  }

  try {
    const parsed = JSON.parse(body);

    if (isPlainObject(parsed) || Array.isArray(parsed)) {
      return formatJsonValue(parsed);
    }

    return body;
  } catch {
    return body;
  }
};

export {
  buildBodyAttributeChips,
  buildLogAttributeChips,
  formatLogBodyForDisplay,
};
export type { LogAttributeChip };
