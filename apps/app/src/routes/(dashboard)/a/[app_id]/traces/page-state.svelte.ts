import { browser } from "$app/environment";
import { goto, invalidate, replaceState } from "$app/navigation";
import { page } from "$app/state";
import {
  getTraceFilterValueSuggestionsQuery,
  getTracesQuery,
} from "$lib/api/traces.remote";
import {
  resolveTimeFilter,
  timeFilterPresets,
  type TimeFilter,
  type TimeFilterPreset,
} from "$lib/core/time-filter";
import { toast } from "@repo/components/ui/sonner";
import { untrack } from "svelte";

import type {
  FilterBuilderFilter,
  FilterBuilderOperator,
} from "../_components/filter-builder";
import type { PageData } from "./$types";
import type {
  ActiveFilter,
  Span,
  TraceFilters,
  TraceSortBy,
  TraceSortOrder,
} from "./types";

const DEFAULT_TIME_FILTER: TimeFilter = {
  kind: "preset",
  preset: "last_24_hours",
};
const TRACES_PAGE_SIZE = 250;
const TRACE_SORT_BY_OPTIONS = ["start_time", "duration", "span_count", "trace_name"] as const satisfies TraceSortBy[];
const TRACE_SORT_ORDER_OPTIONS = ["desc", "asc"] as const satisfies TraceSortOrder[];

class TracesPageState {
  #getData: () => PageData;
  #loadRequest = 0;
  #didHydrateQueryEffect = false;
  #isRouterReady = $state(false);

  live = $state(false);
  timeFilter = $state<TimeFilter>(DEFAULT_TIME_FILTER);
  sortBy = $state<TraceSortBy>("start_time");
  sortOrder = $state<TraceSortOrder>("desc");
  filters = $state<TraceFilters>({ activeFilters: [] });
  traces = $state<Span[]>([]);
  nextCursor = $state<string | null>(null);
  loading = $state(false);

  rangeStart = $derived(resolveTimeFilter(this.timeFilter).start);
  rangeEnd = $derived(resolveTimeFilter(this.timeFilter).end);
  normalizedFilters = $derived(this.filters.activeFilters);
  #querySignature = $derived.by(() =>
    JSON.stringify({
      time: this.timeFilter,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      activeFilters: this.filters.activeFilters,
    }),
  );
  #shallowSearch = $derived.by(() => {
    if (!browser) {
      return "";
    }

    const searchParams = new URLSearchParams(window.location.search);

    if (this.live) {
      searchParams.set("live", "1");
    } else {
      searchParams.delete("live");
    }

    return searchParams.toString();
  });

  constructor(getData: () => PageData) {
    this.#getData = getData;

    const data = getData();
    this.live = data.live;
    this.timeFilter = data.time;
    this.sortBy = data.sortBy;
    this.sortOrder = data.sortOrder;
    this.filters = data.filters;
    this.traces = data.traces;
    this.nextCursor = data.nextCursor;

    $effect(() => {
      if (!this.live) {
        return;
      }

      const id = setInterval(() => {
        if (this.timeFilter.kind === "range") {
          this.timeFilter = {
            kind: "range",
            start: this.timeFilter.start,
            end: new Date().toISOString(),
          };
          return;
        }

        void this.refreshTraces();
      }, 3000);

      return () => clearInterval(id);
    });

    $effect(() => {
      if (!browser || !this.#isRouterReady) {
        return;
      }

      const currentSearch = window.location.search.startsWith("?")
        ? window.location.search.slice(1)
        : window.location.search;

      if (currentSearch === this.#shallowSearch) {
        return;
      }

      const url = new URL(window.location.href);
      url.search = this.#shallowSearch;
      replaceState(url, page.state);
    });

    $effect(() => {
      this.#querySignature;

      if (!this.#isRouterReady) {
        return;
      }

      if (!this.#didHydrateQueryEffect) {
        this.#didHydrateQueryEffect = true;
        return;
      }

      const nextSearch = untrack(() =>
        (() => {
          const searchParams = new URLSearchParams();

          if (this.live) {
            searchParams.set("live", "1");
          }

          if (this.timeFilter.kind === "range") {
            searchParams.set("start", this.timeFilter.start);
            searchParams.set("end", this.timeFilter.end);
          } else {
            searchParams.set("preset", this.timeFilter.preset);
          }

          searchParams.set("sort", this.sortBy);
          searchParams.set("order", this.sortOrder);

          for (const filter of this.filters.activeFilters) {
            searchParams.append("filter", JSON.stringify(filter));
          }

          return searchParams.toString();
        })(),
      );
      const currentSearch = window.location.search.startsWith("?")
        ? window.location.search.slice(1)
        : window.location.search;

      if (currentSearch === nextSearch) {
        return;
      }

      const timeout = setTimeout(() => {
        const requestId = ++this.#loadRequest;
        this.loading = true;

        void goto(`?${nextSearch}`, {
          replaceState: true,
          noScroll: true,
          keepFocus: true,
        }).catch(() => {
          if (requestId !== this.#loadRequest) {
            return;
          }

          toast.error("Failed to update traces.");
          this.loading = false;
        });
      }, 250);

      return () => clearTimeout(timeout);
    });

    $effect(() => {
      const nextData = this.#getData();
      this.traces = nextData.traces;
      this.nextCursor = nextData.nextCursor;
      this.loading = false;
      this.#loadRequest += 1;
    });
  }

  mount = () => {
    const readyTimer = window.setTimeout(() => {
      this.#isRouterReady = true;
    }, 0);

    const syncStateFromLocation = () => {
      const searchParams = new URL(window.location.href).searchParams;
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
      const start = searchParams.get("start");
      const end = searchParams.get("end");
      const preset = searchParams.get("preset");
      const sortBy = searchParams.get("sort");
      const sortOrder = searchParams.get("order");
      const serializedFilters = searchParams
        .getAll("filter")
        .map(parseFilter)
        .filter((filter): filter is ActiveFilter => filter !== null);
      const nextState = {
        live: searchParams.get("live") === "1",
        time:
          start &&
            end &&
            !Number.isNaN(new Date(start).getTime()) &&
            !Number.isNaN(new Date(end).getTime())
            ? ({ kind: "range", start, end } as const)
            : preset &&
              timeFilterPresets.includes(preset as TimeFilterPreset)
              ? ({ kind: "preset", preset: preset as TimeFilterPreset } as const)
              : DEFAULT_TIME_FILTER,
        sortBy:
          sortBy && TRACE_SORT_BY_OPTIONS.includes(sortBy as TraceSortBy)
            ? (sortBy as TraceSortBy)
            : "start_time",
        sortOrder:
          sortOrder &&
            TRACE_SORT_ORDER_OPTIONS.includes(sortOrder as TraceSortOrder)
            ? (sortOrder as TraceSortOrder)
            : "desc",
        filters: {
          activeFilters: serializedFilters,
        },
      };

      this.live = nextState.live;
      this.timeFilter = nextState.time;
      this.sortBy = nextState.sortBy;
      this.sortOrder = nextState.sortOrder;
      this.filters = nextState.filters;
    };

    window.addEventListener("popstate", syncStateFromLocation);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener("popstate", syncStateFromLocation);
    };
  };

  loadValueSuggestions = (input: {
    attribute: string;
    operator: FilterBuilderOperator;
    query: string;
    limit: number;
  }) => getTraceFilterValueSuggestionsQuery(input).run();

  addFilter = (filter: FilterBuilderFilter) => {
    const nextFilter: ActiveFilter = {
      attribute: filter.attribute,
      operator: filter.operator,
      value: filter.value,
    };

    if (
      this.filters.activeFilters.some(
        (value) =>
          value.attribute === nextFilter.attribute &&
          value.operator === nextFilter.operator &&
          value.value === nextFilter.value,
      )
    ) {
      return;
    }

    const replaceRangeFilter = (
      attribute: string,
      operators: ActiveFilter["operator"][],
    ) => {
      this.filters = {
        ...this.filters,
        activeFilters: [
          ...this.filters.activeFilters.filter(
            (value) =>
              !(
                value.attribute === attribute &&
                operators.includes(value.operator)
              ),
          ),
          nextFilter,
        ],
      };
    };

    if (
      ["trace.duration", "trace.span_count"].includes(nextFilter.attribute) &&
      (nextFilter.operator === "gt" || nextFilter.operator === "gte")
    ) {
      replaceRangeFilter(nextFilter.attribute, ["gt", "gte"]);
      return;
    }

    if (
      ["trace.duration", "trace.span_count"].includes(nextFilter.attribute) &&
      (nextFilter.operator === "lt" || nextFilter.operator === "lte")
    ) {
      replaceRangeFilter(nextFilter.attribute, ["lt", "lte"]);
      return;
    }

    this.filters = {
      ...this.filters,
      activeFilters: [...this.filters.activeFilters, nextFilter],
    };
  };

  removeFilter = (filter: FilterBuilderFilter) => {
    this.filters = {
      ...this.filters,
      activeFilters: this.filters.activeFilters.filter(
        (value) =>
          !(
            value.attribute === filter.attribute &&
            value.operator === filter.operator &&
            value.value === filter.value
          ),
      ),
    };
  };

  refreshTraces = async () => {
    const requestId = ++this.#loadRequest;
    this.loading = true;

    try {
      await invalidate(`app:traces:${page.params.app_id}`);
    } catch {
      if (requestId === this.#loadRequest) {
        toast.error("Failed to refresh traces.");
      }
    } finally {
      if (requestId === this.#loadRequest) {
        this.loading = false;
      }
    }
  };

  loadMoreTraces = async () => {
    if (!this.nextCursor || this.loading) {
      return;
    }

    const requestId = this.#loadRequest;
    this.loading = true;

    try {
      const result = await getTracesQuery({
        time: this.timeFilter,
        search: "",
        services: [],
        environments: [],
        scopes: [],
        ingestionKeyIds: [],
        statusCodes: [],
        statuses: [],
        operations: [],
        traceIds: [],
        sortBy: this.sortBy,
        sortOrder: this.sortOrder,
        conditions: this.filters.activeFilters,
        limit: TRACES_PAGE_SIZE,
        cursor: this.nextCursor,
      }).run();

      if (requestId !== this.#loadRequest) {
        return;
      }

      if (result.success === false) {
        toast.error("Failed to load more traces.", {
          description: result.error,
        });
        return;
      }

      this.traces = [...this.traces, ...result.data.traces];
      this.nextCursor = result.data.nextCursor;
    } catch {
      if (requestId === this.#loadRequest) {
        toast.error("Failed to load more traces.");
      }
    } finally {
      if (requestId === this.#loadRequest) {
        this.loading = false;
      }
    }
  };
}

export default TracesPageState;
