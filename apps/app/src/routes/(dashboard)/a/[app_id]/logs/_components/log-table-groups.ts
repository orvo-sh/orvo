import {
  resolveTimeFilter,
  type TimeFilter,
  type TimeFilterPreset,
} from "$lib/core/time-filter";

import type { LogRecord } from "../types";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const generateLogTableGroups = (logs: LogRecord[], timeFilter: TimeFilter) => {
  const pad2 = (value: number) => String(value).padStart(2, "0");

  const { start, end } = resolveTimeFilter(timeFilter);
  const rangeMs = Math.max(Math.abs(end.getTime() - start.getTime()), 1);

  const mode =
    timeFilter.kind === "preset"
      ? (
          {
            last_30_minutes: "five_minute",
            last_hour: "quarter_hour",
            last_4_hours: "hour",
            today: "hour",
            last_24_hours: "hour",
            last_3_days: "six_hour",
            last_7_days: "day",
            last_2_weeks: "day",
            last_month: "day",
          } satisfies Record<
            TimeFilterPreset,
            | "five_minute"
            | "quarter_hour"
            | "hour"
            | "six_hour"
            | "day"
            | "month"
          >
        )[timeFilter.preset]
      : rangeMs <= HOUR_MS
        ? "five_minute"
        : rangeMs <= 3 * HOUR_MS
          ? "quarter_hour"
          : rangeMs <= 24 * HOUR_MS
            ? "hour"
            : rangeMs <= 3 * DAY_MS
              ? "six_hour"
              : rangeMs <= 32 * DAY_MS
                ? "day"
                : "month";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const formatTime = (value: Date) =>
    `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;

  const formatDay = (value: Date) => {
    const startOfValueDay = new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
    ).getTime();
    const diffDays = Math.round((startOfToday - startOfValueDay) / DAY_MS);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";

    return value.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(value.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    });
  };

  const groups = new Map<
    string,
    { key: string; label: string; logs: LogRecord[] }
  >();

  const addToGroup = (
    group: { key: string; label: string },
    log: LogRecord,
  ) => {
    const existingGroup = groups.get(group.key);

    if (existingGroup) {
      existingGroup.logs.push(log);
      return;
    }

    groups.set(group.key, {
      ...group,
      logs: [log],
    });
  };

  for (const log of logs) {
    const date = new Date(log.timestamp);

    if (Number.isNaN(date.getTime())) {
      addToGroup({ key: "unknown", label: "Unknown" }, log);
      continue;
    }

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();

    let bucketStart: Date;
    let bucketDurationMs = 0;

    if (mode === "five_minute") {
      bucketStart = new Date(
        year,
        month,
        day,
        hour,
        Math.floor(minute / 5) * 5,
      );
      bucketDurationMs = 5 * MINUTE_MS;
    } else if (mode === "quarter_hour") {
      bucketStart = new Date(
        year,
        month,
        day,
        hour,
        Math.floor(minute / 15) * 15,
      );
      bucketDurationMs = 15 * MINUTE_MS;
    } else if (mode === "hour") {
      bucketStart = new Date(year, month, day, hour);
      bucketDurationMs = HOUR_MS;
    } else if (mode === "six_hour") {
      bucketStart = new Date(year, month, day, Math.floor(hour / 6) * 6);
      bucketDurationMs = 6 * HOUR_MS;
    } else if (mode === "day") {
      bucketStart = new Date(year, month, day);
    } else {
      bucketStart = new Date(year, month);
    }

    const key =
      mode === "month"
        ? `${bucketStart.getFullYear()}-${pad2(bucketStart.getMonth() + 1)}`
        : mode === "day"
          ? `${bucketStart.getFullYear()}-${pad2(bucketStart.getMonth() + 1)}-${pad2(bucketStart.getDate())}`
          : `${bucketStart.getFullYear()}-${pad2(bucketStart.getMonth() + 1)}-${pad2(bucketStart.getDate())}-${pad2(bucketStart.getHours())}-${pad2(bucketStart.getMinutes())}`;

    const label =
      mode === "month"
        ? bucketStart.toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })
        : mode === "day"
          ? formatDay(bucketStart)
          : (() => {
              const bucketEnd = new Date(
                bucketStart.getTime() + bucketDurationMs,
              );
              const isToday =
                bucketStart.getFullYear() === now.getFullYear() &&
                bucketStart.getMonth() === now.getMonth() &&
                bucketStart.getDate() === now.getDate();

              return isToday
                ? `${formatTime(bucketStart)} - ${formatTime(bucketEnd)}`
                : `${formatDay(bucketStart)} · ${formatTime(bucketStart)} - ${formatTime(bucketEnd)}`;
            })();

    addToGroup({ key, label }, log);
  }

  return [...groups.values()];
};

export { generateLogTableGroups };
