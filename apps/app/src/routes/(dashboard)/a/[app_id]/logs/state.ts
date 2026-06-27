import type {
  ActiveLogFilter,
  LogFilters,
  LogTimeFilter,
  LogTimePreset,
} from "./types";

const logTimePresets = [
  "last_hour",
  "today",
  "last_24_hours",
  "last_3_days",
  "last_7_days",
  "last_2_weeks",
  "last_month",
] satisfies LogTimePreset[];

const MIN_VOLUME_BUCKET_COUNT = 24;
const MAX_VOLUME_BUCKET_COUNT = 120;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_FALLBACK_BUCKET_COUNT = 72;
const AUTO_VOLUME_BUCKET_SIZES_MS = [
  { maxRangeMs: HOUR_MS, bucketSizeMs: MINUTE_MS },
  { maxRangeMs: 4 * HOUR_MS, bucketSizeMs: 2 * MINUTE_MS },
  { maxRangeMs: 6 * HOUR_MS, bucketSizeMs: 5 * MINUTE_MS },
  { maxRangeMs: 12 * HOUR_MS, bucketSizeMs: 10 * MINUTE_MS },
  { maxRangeMs: DAY_MS, bucketSizeMs: 20 * MINUTE_MS },
  { maxRangeMs: 2 * DAY_MS, bucketSizeMs: 30 * MINUTE_MS },
  { maxRangeMs: 7 * DAY_MS, bucketSizeMs: 2 * HOUR_MS },
  { maxRangeMs: 30 * DAY_MS, bucketSizeMs: 12 * HOUR_MS },
] as const;

const isLogTimePreset = (value: string): value is LogTimePreset =>
  logTimePresets.includes(value as LogTimePreset);

const parseLogFilter = (value: string): ActiveLogFilter | null => {
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
      operator: parsed.operator as ActiveLogFilter["operator"],
      value: parsed.value,
    };
  } catch {
    return null;
  }
};

const resolveLogStateFromSearchParams = (searchParams: URLSearchParams) => {
  const startAtUtc = searchParams.get("start");
  const endAtUtc = searchParams.get("end");
  const preset = searchParams.get("preset");
  const serializedFilters = searchParams
    .getAll("filter")
    .map(parseLogFilter)
    .filter((filter): filter is ActiveLogFilter => filter !== null);

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
      : preset && isLogTimePreset(preset)
        ? ({
            kind: "preset",
            preset,
          } as const)
        : ({
            kind: "preset",
            preset: "last_24_hours",
          } as const);

  return {
    live: searchParams.get("live") === "true",
    selectedLogId: searchParams.get("log")?.trim() || null,
    time,
    filters: {
      activeFilters:
        serializedFilters.length > 0 ? serializedFilters : [],
    },
  };
};

const createLogStateSearchParams = (
  live: boolean,
  time: LogTimeFilter,
  filters: LogFilters,
  selectedLogId: string | null,
) => {
  const searchParams = new URLSearchParams();

  if (live) {
    searchParams.set("live", "true");
  }

  if (time.kind === "range") {
    searchParams.set("start", time.startAtUtc);
    searchParams.set("end", time.endAtUtc);
  } else {
    searchParams.set("preset", time.preset);
  }

  for (const filter of filters.activeFilters) {
    searchParams.append("filter", JSON.stringify(filter));
  }

  if (selectedLogId) {
    searchParams.set("log", selectedLogId);
  }

  return searchParams;
};

const resolveLogPresetRange = (preset: LogTimePreset, now = new Date()) => {
  switch (preset) {
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

const resolveLogTimeRange = (time: LogTimeFilter, now = new Date()) => {
  if (time.kind === "range") {
    return {
      start: new Date(time.startAtUtc),
      end: new Date(time.endAtUtc),
    };
  }

  return resolveLogPresetRange(time.preset, now);
};

const resolveLogVolumeBucketCount = (start: Date, end: Date) => {
  const rangeMs = Math.max(end.getTime() - start.getTime(), 1);
  const bucketSizeMs =
    AUTO_VOLUME_BUCKET_SIZES_MS.find(({ maxRangeMs }) => rangeMs <= maxRangeMs)
      ?.bucketSizeMs ?? Math.ceil(rangeMs / DEFAULT_FALLBACK_BUCKET_COUNT);

  return Math.min(
    MAX_VOLUME_BUCKET_COUNT,
    Math.max(MIN_VOLUME_BUCKET_COUNT, Math.ceil(rangeMs / bucketSizeMs)),
  );
};

const createLogsServiceInput = (
  time: LogTimeFilter,
  filters: { activeFilters: ActiveLogFilter[] },
) => ({
  time,
  activeFilters: filters.activeFilters,
});

export {
  createLogsServiceInput,
  createLogStateSearchParams,
  resolveLogStateFromSearchParams,
  resolveLogTimeRange,
  resolveLogVolumeBucketCount,
};
