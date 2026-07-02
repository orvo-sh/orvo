import { error } from "@sveltejs/kit";
import { timeFilterPresets, type TimeFilter, type TimeFilterPreset } from "$lib/core/time-filter";
import type { PageServerLoad } from "./$types";
import type { ActiveFilter, TraceFilters, TraceSortBy, TraceSortOrder } from "./types";

const defaultTime: TimeFilter = { kind: "preset", preset: "last_24_hours" };
const defaultFilters: TraceFilters = { activeFilters: [] };
const traceSortByOptions = ["start_time", "duration", "span_count", "trace_name"] as const satisfies TraceSortBy[];
const traceSortOrderOptions = ["desc", "asc"] as const satisfies TraceSortOrder[];

export const load = (async ({ depends, locals, params, url }) => {
  depends(`app:traces:${params.app_id}`);

  const parseFilter = (value: string): ActiveFilter | null => {
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
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const preset = url.searchParams.get("preset");
  const sortBy = url.searchParams.get("sort");
  const sortOrder = url.searchParams.get("order");
  const serializedFilters = url.searchParams
    .getAll("filter")
    .map(parseFilter)
    .filter((filter): filter is ActiveFilter => filter !== null);
  const state = {
    live: url.searchParams.get("live") === "1",
    time:
      start &&
      end &&
      !Number.isNaN(new Date(start).getTime()) &&
      !Number.isNaN(new Date(end).getTime())
        ? ({ kind: "range", start, end } as const)
        : preset &&
            timeFilterPresets.includes(preset as TimeFilterPreset)
          ? ({ kind: "preset", preset: preset as TimeFilterPreset } as const)
          : defaultTime,
    sortBy:
      sortBy && traceSortByOptions.includes(sortBy as TraceSortBy)
        ? (sortBy as TraceSortBy)
        : "start_time",
    sortOrder:
      sortOrder && traceSortOrderOptions.includes(sortOrder as TraceSortOrder)
        ? (sortOrder as TraceSortOrder)
        : "desc",
    filters: {
      activeFilters:
        serializedFilters.length > 0
          ? serializedFilters
          : defaultFilters.activeFilters,
    },
  };
  const [result, filterAttributesResult] = await Promise.all([
    locals.container.tracesService.getTraces(
      {
        time: state.time,
        search: "",
        services: [],
        environments: [],
        scopes: [],
        ingestionKeyIds: [],
        statusCodes: [],
        statuses: [],
        operations: [],
        traceIds: [],
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        conditions: state.filters.activeFilters,
        limit: 250,
      },
      { appId: params.app_id },
    ),
    locals.container.tracesService.getTraceFilterAttributes({
      appId: params.app_id,
    }),
  ]);

  if (!result.success) throw error(500, result.error);
  if (!filterAttributesResult.success) throw error(500, filterAttributesResult.error);

  return {
    live: state.live,
    time: state.time,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    filters: state.filters,
    traces: result.data.traces,
    nextCursor: result.data.nextCursor,
    filterAttributes: filterAttributesResult.data.attributes,
  };
}) satisfies PageServerLoad;
