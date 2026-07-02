import { timeFilterPresets, type TimeFilter } from "$lib/core/time-filter";
import type {
  ActiveLogFilter,
  LogFilters,
  LogSortBy,
  LogSortOrder,
  LogTimePreset,
} from "./types";

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
const logSortByOptions = [
  "timestamp",
  "severity",
  "service",
] as const satisfies LogSortBy[];
const logSortOrderOptions = ["desc", "asc"] as const satisfies LogSortOrder[];

const isLogTimePreset = (value: string): value is LogTimePreset =>
  timeFilterPresets.includes(value as LogTimePreset);

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
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const preset = searchParams.get("preset");
  const sortBy = searchParams.get("sort");
  const sortOrder = searchParams.get("order");
  const serializedFilters = searchParams
    .getAll("filter")
    .map(parseLogFilter)
    .filter((filter): filter is ActiveLogFilter => filter !== null);

  const time =
    start &&
    end &&
    !Number.isNaN(new Date(start).getTime()) &&
    !Number.isNaN(new Date(end).getTime())
      ? ({
          kind: "range",
          start: start,
          end: end,
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
    sortBy:
      sortBy && logSortByOptions.includes(sortBy as LogSortBy)
        ? (sortBy as LogSortBy)
        : "timestamp",
    sortOrder:
      sortOrder && logSortOrderOptions.includes(sortOrder as LogSortOrder)
        ? (sortOrder as LogSortOrder)
        : "desc",
    time,
    filters: {
      activeFilters: serializedFilters.length > 0 ? serializedFilters : [],
    },
  };
};

const createLogStateSearchParams = (
  live: boolean,
  time: TimeFilter,
  filters: LogFilters,
  sortBy: LogSortBy,
  sortOrder: LogSortOrder,
  selectedLogId: string | null,
) => {
  const searchParams = new URLSearchParams();

  if (live) {
    searchParams.set("live", "true");
  }

  if (time.kind === "range") {
    searchParams.set("start", time.start);
    searchParams.set("end", time.end);
  } else {
    searchParams.set("preset", time.preset);
  }

  searchParams.set("sort", sortBy);
  searchParams.set("order", sortOrder);

  for (const filter of filters.activeFilters) {
    searchParams.append("filter", JSON.stringify(filter));
  }

  if (selectedLogId) {
    searchParams.set("log", selectedLogId);
  }

  return searchParams;
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

export {
  createLogStateSearchParams,
  logSortByOptions,
  logSortOrderOptions,
  resolveLogStateFromSearchParams,
  resolveLogVolumeBucketCount,
};
