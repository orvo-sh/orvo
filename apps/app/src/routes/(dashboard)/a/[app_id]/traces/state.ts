import type { LogTimeFilter, LogTimePreset } from "../logs/types";
import type { ActiveFilter, TraceFilters } from "./types";

const traceTimePresets = [
  "last_hour",
  "today",
  "last_24_hours",
  "last_3_days",
  "last_7_days",
  "last_2_weeks",
  "last_month",
] satisfies LogTimePreset[];

const createDefaultTraceTimeFilter = (): LogTimeFilter => ({
  kind: "preset",
  preset: "last_24_hours",
});

const createDefaultTraceFilters = (): TraceFilters => ({
  activeFilters: [],
});

const isTraceTimePreset = (value: string): value is LogTimePreset =>
  traceTimePresets.includes(value as LogTimePreset);

const serializeTraceFilter = (filter: ActiveFilter) => JSON.stringify(filter);

const parseTraceFilter = (value: string): ActiveFilter | null => {
  try {
    const parsed = JSON.parse(value);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.attribute !== "string" ||
      typeof parsed.operator !== "string" ||
      typeof parsed.value !== "string"
    ) {
      return null;
    }

    return {
      attribute: parsed.attribute,
      operator: parsed.operator,
      value: parsed.value,
    } as ActiveFilter;
  } catch {
    return null;
  }
};

const createLegacyFiltersFromSearchParams = (searchParams: URLSearchParams) => {
  const filters: ActiveFilter[] = [];
  const addLegacyFilter = (
    attribute: string,
    value: string,
    operator = "eq",
  ) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    filters.push({
      attribute,
      operator: operator as ActiveFilter["operator"],
      value: trimmed,
    });
  };
  const parseList = (...keys: string[]) =>
    Array.from(
      new Set(
        keys
          .flatMap((key) => searchParams.getAll(key))
          .flatMap((value) => value.split(","))
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

  for (const value of parseList("service", "services")) {
    addLegacyFilter("service.name", value);
  }

  for (const value of parseList("environment", "environments")) {
    addLegacyFilter("deployment.environment", value);
  }

  for (const value of parseList("status", "statuses")) {
    addLegacyFilter("trace.status", value);
  }

  for (const value of parseList("operation", "operations")) {
    addLegacyFilter("trace.name", value);
  }

  for (const value of parseList("traceId", "traceIds")) {
    addLegacyFilter("trace.id", value);
  }

  for (const [key, operator] of [
    ["duration_gt", "gt"],
    ["duration_gte", "gte"],
    ["duration_lt", "lt"],
    ["duration_lte", "lte"],
  ] as const) {
    const value = searchParams.get(key)?.trim();
    if (!value) {
      continue;
    }

    addLegacyFilter("trace.duration", value, operator);
  }

  return filters;
};

const resolveTraceStateFromSearchParams = (
  searchParams: URLSearchParams,
  fallbackTime = createDefaultTraceTimeFilter(),
  fallbackFilters = createDefaultTraceFilters(),
) => {
  const startAtUtc = searchParams.get("start");
  const endAtUtc = searchParams.get("end");
  const preset = searchParams.get("preset");
  const legacyFilters = createLegacyFiltersFromSearchParams(searchParams);
  const serializedFilters = searchParams
    .getAll("filter")
    .map(parseTraceFilter)
    .filter((filter): filter is ActiveFilter => filter !== null);

  const time =
    startAtUtc &&
    endAtUtc &&
    !Number.isNaN(new Date(startAtUtc).getTime()) &&
    !Number.isNaN(new Date(endAtUtc).getTime())
      ? ({
          kind: "range",
          startAtUtc,
          endAtUtc,
        } as const)
      : preset && isTraceTimePreset(preset)
        ? ({
            kind: "preset",
            preset,
          } as const)
        : fallbackTime;

  return {
    time,
    filters: {
      activeFilters:
        serializedFilters.length > 0
          ? serializedFilters
          : legacyFilters.length > 0
            ? legacyFilters
            : fallbackFilters.activeFilters,
    },
  };
};

const createTraceStateSearchParams = (
  time: LogTimeFilter,
  filters: TraceFilters,
) => {
  const searchParams = new URLSearchParams();

  if (time.kind === "range") {
    searchParams.set("start", time.startAtUtc);
    searchParams.set("end", time.endAtUtc);
  } else {
    searchParams.set("preset", time.preset);
  }

  for (const filter of filters.activeFilters) {
    searchParams.append("filter", serializeTraceFilter(filter));
  }

  return searchParams;
};

const parseTraceDurationToNs = (value: string): number | undefined => {
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

const resolveTraceTimeRange = (time: LogTimeFilter) => {
  const now = new Date();

  if (time.kind === "range") {
    return {
      start: new Date(time.startAtUtc),
      end: new Date(time.endAtUtc),
    };
  }

  switch (time.preset) {
    case "last_hour":
      return { start: new Date(now.getTime() - 60 * 60 * 1000), end: now };
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    case "last_24_hours":
      return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now };
    case "last_3_days":
      return {
        start: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_7_days":
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_2_weeks":
      return {
        start: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case "last_month":
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };
  }
};

const createTraceServiceInput = (
  time: LogTimeFilter,
  filters: TraceFilters,
) => ({
  time,
  search: "",
  services: [],
  environments: [],
  scopes: [],
  ingestionKeyIds: [],
  statusCodes: [],
  statuses: [],
  operations: [],
  traceIds: [],
  conditions: filters.activeFilters,
});

export {
  createDefaultTraceFilters,
  createDefaultTraceTimeFilter,
  createTraceServiceInput,
  createTraceStateSearchParams,
  parseTraceDurationToNs,
  resolveTraceStateFromSearchParams,
  resolveTraceTimeRange,
};
