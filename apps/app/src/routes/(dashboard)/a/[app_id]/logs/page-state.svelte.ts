import { browser } from "$app/environment";
import { goto, invalidate, replaceState } from "$app/navigation";
import { page } from "$app/state";
import {
    getLogByIdQuery,
    getLogFilterValueSuggestionsQuery,
    getLogsQuery,
} from "$lib/api/logs.remote";
import { resolveTimeFilter, type TimeFilter } from "$lib/core/time-filter";
import { toast } from "@repo/components/ui/sonner";
import { untrack } from "svelte";

import type {
    FilterBuilderFilter,
    FilterBuilderOperator,
} from "../_components/filter-builder";
import type { PageData } from "./$types";
import {
    createLogStateSearchParams,
    resolveLogStateFromSearchParams,
    resolveLogVolumeBucketCount,
} from "./state";
import type {
    ActiveLogFilter,
    LogCursor,
    LogFilters,
    LogRecord,
    LogVolumeBucket,
} from "./types";

const LOGS_PAGE_SIZE = 250;
const DEFAULT_TIME_FILTER: TimeFilter = {
    kind: "preset",
    preset: "last_24_hours",
};

class LogsPageState {
    #getData: () => PageData;
    #loadRequest = 0;
    #selectedLogRequest = 0;
    #didHydrateQueryEffect = false;
    #isRouterReady = $state(false);

    live = $state(false);
    selectedLogId = $state<string | null>(null);
    asideOpen = $state(false);
    time = $state<TimeFilter>(DEFAULT_TIME_FILTER);
    filters = $state<LogFilters>({ activeFilters: [] });
    logs = $state<LogRecord[]>([]);
    selectedLogRecord = $state<LogRecord | null>(null);
    selectedLogLoading = $state(false);
    volumeBuckets = $state<LogVolumeBucket[]>([]);
    nextCursor = $state<LogCursor | null>(null);
    loading = $state(false);
    loadingMore = $state(false);
    rangeStart = $state(new Date());
    rangeEnd = $state(new Date());

    logTimezone = $derived(Intl.DateTimeFormat().resolvedOptions().timeZone);
    normalizedFilters = $derived(this.filters.activeFilters);
    selectedLog = $derived(
        this.selectedLogId
            ? (this.logs.find((log) => log.id === this.selectedLogId) ??
                (this.selectedLogRecord?.id === this.selectedLogId
                    ? this.selectedLogRecord
                    : null))
            : null,
    );
    resolvedLogVolumeBucketCount = $derived(
        resolveLogVolumeBucketCount(this.rangeStart, this.rangeEnd),
    );
    #querySignature = $derived.by(() =>
        JSON.stringify({
            time: this.time,
            activeFilters: this.filters.activeFilters,
        }),
    );
    #shallowSearch = $derived.by(() => {
        if (!browser) {
            return "";
        }

        const searchParams = new URLSearchParams(window.location.search);

        if (this.live) {
            searchParams.set("live", "true");
        } else {
            searchParams.delete("live");
        }

        if (this.selectedLogId) {
            searchParams.set("log", this.selectedLogId);
        } else {
            searchParams.delete("log");
        }

        return searchParams.toString();
    });

    constructor(getData: () => PageData) {
        this.#getData = getData;

        const data = getData();
        this.live = data.live;
        this.selectedLogId = data.selectedLogId;
        this.asideOpen = Boolean(data.selectedLogId);
        this.time = data.time;
        this.filters = data.filters;
        this.logs = data.logs;
        this.selectedLogRecord = data.selectedLog ?? null;
        this.volumeBuckets = data.volumeBuckets;
        this.nextCursor = data.nextCursor;

        const initialRange = resolveTimeFilter(data.time);
        this.rangeStart = initialRange.start;
        this.rangeEnd = initialRange.end;

        $effect(() => {
            const { start, end } = resolveTimeFilter(this.time);
            this.rangeStart = start;
            this.rangeEnd = end;
        });

        $effect(() => {
            if (!this.selectedLogId) {
                this.#selectedLogRequest += 1;
                this.selectedLogRecord = null;
                this.selectedLogLoading = false;
                return;
            }

            const visibleSelectedLog =
                this.logs.find((log) => log.id === this.selectedLogId) ?? null;
            if (visibleSelectedLog) {
                this.#selectedLogRequest += 1;
                this.selectedLogRecord = visibleSelectedLog;
                this.selectedLogLoading = false;
                return;
            }

            if (this.selectedLogRecord?.id === this.selectedLogId) {
                this.#selectedLogRequest += 1;
                this.selectedLogLoading = false;
                return;
            }

            const requestId = ++this.#selectedLogRequest;
            this.selectedLogLoading = true;

            void (async () => {
                try {
                    const result = await getLogByIdQuery({ id: this.selectedLogId! }).run();
                    if (requestId === this.#selectedLogRequest) {
                        this.selectedLogRecord = result.success ? result.data.log : null;
                    }
                } catch {
                    if (requestId === this.#selectedLogRequest) {
                        this.selectedLogRecord = null;
                    }
                } finally {
                    if (requestId === this.#selectedLogRequest) {
                        this.selectedLogLoading = false;
                    }
                }
            })();
        });

        $effect(() => {
            if (this.selectedLogId && !this.selectedLog && !this.loading && !this.selectedLogLoading) {
                this.asideOpen = false;
            }
        });

        $effect(() => {
            if (!this.asideOpen && this.selectedLogId) {
                this.selectedLogId = null;
            }
        });

        $effect(() => {
            if (!this.live) {
                return;
            }

            const id = setInterval(() => {
                if (this.time.kind === "range") {
                    this.time = {
                        kind: "range",
                        start: this.time.start,
                        end: new Date().toISOString(),
                    };
                    return;
                }

                void this.refreshLogs();
            }, 5000);

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
                createLogStateSearchParams(
                    this.live,
                    this.time,
                    this.filters,
                    this.selectedLogId,
                ).toString(),
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

                    toast.error("Failed to update logs.");
                    this.loading = false;
                });
            }, 250);

            return () => clearTimeout(timeout);
        });

        $effect(() => {
            const nextData = this.#getData();
            this.logs = nextData.logs;
            this.selectedLogRecord = nextData.selectedLog;
            this.selectedLogLoading = false;
            this.#selectedLogRequest += 1;
            this.nextCursor = nextData.nextCursor;
            this.volumeBuckets = nextData.volumeBuckets;
            this.loading = false;
            this.loadingMore = false;
            this.#loadRequest += 1;
        });
    }

    mount = () => {
        const readyTimer = window.setTimeout(() => {
            this.#isRouterReady = true;
        }, 0);

        const onWindowKeydown = (event: KeyboardEvent) => {
            const target = event.target;
            if (
                !this.asideOpen ||
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                (target instanceof HTMLElement && target.isContentEditable)
            ) {
                return;
            }

            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
                return;
            }

            const currentIndex = this.logs.findIndex(
                (log) => log.id === this.selectedLogId,
            );
            const nextLog =
                currentIndex === -1
                    ? null
                    : this.logs[currentIndex + (event.key === "ArrowUp" ? -1 : 1)];

            if (!nextLog?.id) {
                return;
            }

            event.preventDefault();
            this.selectedLogId = nextLog.id;
        };

        const syncStateFromLocation = () => {
            const nextState = resolveLogStateFromSearchParams(
                new URL(window.location.href).searchParams,
            );

            this.live = nextState.live;
            this.selectedLogId = nextState.selectedLogId;
            this.asideOpen = Boolean(nextState.selectedLogId);
            this.time = nextState.time;
            this.filters = nextState.filters;
        };

        window.addEventListener("keydown", onWindowKeydown);
        window.addEventListener("popstate", syncStateFromLocation);

        return () => {
            window.clearTimeout(readyTimer);
            window.removeEventListener("keydown", onWindowKeydown);
            window.removeEventListener("popstate", syncStateFromLocation);
        };
    };

    loadValueSuggestions = (input: {
        attribute: string;
        operator: FilterBuilderOperator;
        query: string;
        limit: number;
    }) => {
        if (
            input.operator !== "eq" &&
            input.operator !== "neq" &&
            input.operator !== "contains" &&
            input.operator !== "not_contains" &&
            input.operator !== "in" &&
            input.operator !== "not_in"
        ) {
            return Promise.resolve({ success: true as const, data: { values: [] } });
        }

        return getLogFilterValueSuggestionsQuery({
            ...input,
            operator: input.operator,
        }).run();
    };

    addFilter = (filter: FilterBuilderFilter) => {
        if (
            filter.operator !== "eq" &&
            filter.operator !== "neq" &&
            filter.operator !== "contains" &&
            filter.operator !== "not_contains" &&
            filter.operator !== "in" &&
            filter.operator !== "not_in"
        ) {
            toast.error("This filter operator is not supported for logs.");
            return;
        }

        const nextFilter: ActiveLogFilter = {
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

    refreshLogs = async () => {
        const requestId = ++this.#loadRequest;
        this.loading = true;

        try {
            await invalidate(`app:logs:${page.params.app_id}`);
        } catch {
            if (requestId === this.#loadRequest) {
                toast.error("Failed to refresh logs.");
            }
        } finally {
            if (requestId === this.#loadRequest) {
                this.loading = false;
            }
        }
    };

    loadMoreLogs = async () => {
        if (!this.nextCursor || this.loading || this.loadingMore) {
            return;
        }

        const requestId = this.#loadRequest;
        this.loadingMore = true;

        try {
            const result = await getLogsQuery({
                time: this.time,
                activeFilters: this.filters.activeFilters,
                limit: LOGS_PAGE_SIZE,
                cursor: this.nextCursor,
            }).run();

            if (requestId !== this.#loadRequest) {
                return;
            }

            if (result.success === false) {
                toast.error("Failed to load more logs.", {
                    description: result.error,
                });
                return;
            }

            this.logs = [...this.logs, ...result.data.logs];
            this.nextCursor = result.data.nextCursor;
        } catch {
            if (requestId === this.#loadRequest) {
                toast.error("Failed to load more logs.");
            }
        } finally {
            if (requestId === this.#loadRequest) {
                this.loadingMore = false;
            }
        }
    };

    onBucketClick = (start: Date, end: Date) => {
        this.time = {
            kind: "range",
            start: start.toISOString(),
            end: end.toISOString(),
        };
    };

    onSelectLog = (log: LogRecord) => {
        if (!log.id) {
            return;
        }

        if (this.selectedLogId === log.id) {
            this.asideOpen = false;
            return;
        }

        this.selectedLogId = log.id;
        this.asideOpen = true;
    };

    closeSelectedLog = () => {
        this.asideOpen = false;
    };
}

export default LogsPageState;
