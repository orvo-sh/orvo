<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidateAll, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import {
    getLogByIdQuery,
    getLogFilterValueSuggestionsQuery,
    getLogsQuery,
    getLogVolumeQuery,
  } from "$lib/api/logs.remote";
  import { markOrganizationActivationTelemetryViewedCommand } from "$lib/api/organization-activation.remote";
  import {
    completeOrganizationActivationStep,
    restoreOrganizationActivation,
  } from "$lib/stores/organization-activation.svelte";
  import { onMount, untrack } from "svelte";

  import {
    FilterBuilder,
    type FilterBuilderFilter,
  } from "../_components/filter-builder";
  import LiveRefreshButtonGroup from "../_components/live-refresh-button-group.svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import LogDetailPanel from "./_components/log-detail-panel.svelte";
  import LogTable from "./_components/log-table.svelte";
  import LogVolumeChart from "./_components/log-volume-chart.svelte";
  import TimeRangePicker from "./_components/time-range-picker.svelte";
  import {
    createLogsServiceInput,
    createLogStateSearchParams,
    resolveLogStateFromSearchParams,
    resolveLogTimeRange,
    resolveLogVolumeBucketCount,
  } from "./state";
  import type {
    ActiveLogFilter,
    LogFilters,
    LogRecord,
    LogTimeFilter,
    LogVolumeBucket,
  } from "./types.js";

  let { data } = $props();

  const isValidDate = (date: Date) => !Number.isNaN(date.getTime());
  const initialLogState = untrack(() => ({
    live: data.live,
    selectedLogId: data.selectedLogId,
    time: data.time,
    filters: data.filters,
  }));
  const initialTimeRange = resolveLogTimeRange(initialLogState.time);

  let live = $state(initialLogState.live);
  let selectedLogId = $state<string | null>(initialLogState.selectedLogId);
  let asideOpen = $state(Boolean(initialLogState.selectedLogId));
  let time = $state<LogTimeFilter>(initialLogState.time);
  let rangeStart = $state(initialTimeRange.start);
  let rangeEnd = $state(initialTimeRange.end);
  let filters = $state<LogFilters>(initialLogState.filters);
  let logs = $state<LogRecord[]>(data.logs);
  let selectedLogRecord = $state<LogRecord | null>(data.selectedLog ?? null);
  let selectedLogLoading = $state(false);
  let volumeBuckets = $state<LogVolumeBucket[]>(data.volumeBuckets);
  let loading = $state(false);
  let error = $state(data.error);
  let loadRequest = 0;
  let selectedLogRequest = 0;
  let telemetryActivationSent = $state(false);

  const logTimezone = $derived(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const normalizedFilters = $derived(filters?.activeFilters ?? []);
  const selectedLog = $derived(
    selectedLogId
      ? (logs.find((log) => log.id === selectedLogId) ??
          (selectedLogRecord?.id === selectedLogId ? selectedLogRecord : null))
      : null,
  );

  const syncEffectiveRange = (nextTime: LogTimeFilter) => {
    const nextRange = resolveLogTimeRange(nextTime);
    if (isValidDate(nextRange.start) && isValidDate(nextRange.end)) {
      rangeStart = nextRange.start;
      rangeEnd = nextRange.end;
      return;
    }

    const { start, end } = resolveLogTimeRange({
      kind: "preset",
      preset: "last_24_hours",
    });
    rangeStart = start;
    rangeEnd = end;
  };

  const resolvedLogVolumeBucketCount = $derived(
    resolveLogVolumeBucketCount(rangeStart, rangeEnd),
  );

  const refreshLogs = async () => {
    const requestId = ++loadRequest;
    loading = true;
    error = "";

    const [logsResult, volumeResult] = await Promise.all([
      getLogsQuery({
        ...createLogsServiceInput(time, filters),
        limit: 250,
      }).run(),
      getLogVolumeQuery({
        ...createLogsServiceInput(time, filters),
        bucketCount: resolvedLogVolumeBucketCount,
      }).run(),
    ]);

    if (requestId !== loadRequest) {
      return;
    }

    if (logsResult.success === false) {
      error = logsResult.error;
      loading = false;
      return;
    }

    if (volumeResult.success === false) {
      error = volumeResult.error;
      loading = false;
      return;
    }

    logs = logsResult.data.logs;
    volumeBuckets = volumeResult.data.buckets;
    loading = false;
  };

  const refreshQuerySignature = $derived.by(() =>
    JSON.stringify({
      time,
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
      activeFilters: filters.activeFilters,
    }),
  );
  const urlStateSearch = $derived(
    createLogStateSearchParams(live, time, filters, selectedLogId).toString(),
  );

  const loadValueSuggestions = (input: {
    attribute: string;
    operator: ActiveLogFilter["operator"];
    query: string;
    limit: number;
  }) => getLogFilterValueSuggestionsQuery(input).run();

  const addFilter = (filter: FilterBuilderFilter) => {
    const activeFilters = filters?.activeFilters ?? [];
    const exists = activeFilters.some(
      (value) =>
        value.attribute === filter.attribute &&
        value.operator === filter.operator &&
        value.value === filter.value,
    );

    if (exists) {
      return;
    }

    filters = {
      ...(filters ?? { activeFilters: [] }),
      activeFilters: [...activeFilters, filter],
    };
  };

  const removeFilter = (filter: FilterBuilderFilter) => {
    const activeFilters = filters?.activeFilters ?? [];

    filters = {
      ...(filters ?? { activeFilters: [] }),
      activeFilters: activeFilters.filter(
        (value) =>
          !(
            value.attribute === filter.attribute &&
            value.operator === filter.operator &&
            value.value === filter.value
          ),
      ),
    };
  };

  const refresh = async () => {
    if (time.kind === "range") {
      time = {
        kind: "range",
        startAtUtc: time.startAtUtc,
        endAtUtc: new Date().toISOString(),
      };
      return;
    }

    await invalidateAll();
  };

  const onBucketClick = (start: Date, end: Date) => {
    time = {
      kind: "range",
      startAtUtc: start.toISOString(),
      endAtUtc: end.toISOString(),
    };
  };

  const onSelectLog = (log: LogRecord) => {
    if (!log.id) {
      return;
    }

    if (selectedLogId === log.id) {
      asideOpen = false;
      return;
    }

    selectedLogId = log.id;
    asideOpen = true;
  };

  const closeSelectedLog = () => {
    asideOpen = false;
  };

  const isEditableTarget = (target: EventTarget | null) =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);

  const selectRelativeLog = (offset: -1 | 1) => {
    if (!asideOpen || !selectedLogId) {
      return;
    }

    const currentIndex = logs.findIndex((log) => log.id === selectedLogId);
    if (currentIndex === -1) {
      return;
    }

    const nextLog = logs[currentIndex + offset];
    if (!nextLog?.id) {
      return;
    }

    selectedLogId = nextLog.id;
  };

  $effect(() => {
    time;
    syncEffectiveRange(time);
  });

  $effect(() => {
    if (!selectedLogId) {
      selectedLogRequest += 1;
      selectedLogRecord = null;
      selectedLogLoading = false;
      return;
    }

    const visibleSelectedLog =
      logs.find((log) => log.id === selectedLogId) ?? null;
    if (visibleSelectedLog) {
      selectedLogRequest += 1;
      selectedLogRecord = visibleSelectedLog;
      selectedLogLoading = false;
      return;
    }

    if (selectedLogRecord?.id === selectedLogId) {
      selectedLogRequest += 1;
      selectedLogLoading = false;
      return;
    }

    const requestId = ++selectedLogRequest;
    selectedLogLoading = true;

    void (async () => {
      try {
        const result = await getLogByIdQuery({ id: selectedLogId }).run();

        if (requestId !== selectedLogRequest) {
          return;
        }

        selectedLogRecord = result.success ? result.data.log : null;
      } catch {
        if (requestId !== selectedLogRequest) {
          return;
        }

        selectedLogRecord = null;
      } finally {
        if (requestId === selectedLogRequest) {
          selectedLogLoading = false;
        }
      }
    })();
  });

  $effect(() => {
    if (selectedLogId && !selectedLog && !loading) {
      if (selectedLogLoading) {
        return;
      }

      asideOpen = false;
    }
  });

  $effect(() => {
    if (asideOpen) {
      return;
    }

    if (!selectedLogId) {
      return;
    }

    selectedLogId = null;
  });

  $effect(() => {
    if (!live) {
      return;
    }

    const id = setInterval(() => {
      if (time.kind === "range") {
        time = {
          kind: "range",
          startAtUtc: time.startAtUtc,
          endAtUtc: new Date().toISOString(),
        };
        return;
      }

      syncEffectiveRange(time);
    }, 5000);

    return () => clearInterval(id);
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    const nextSearch = urlStateSearch;
    const currentSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;

    if (currentSearch === nextSearch) {
      return;
    }

    const url = new URL(window.location.href);
    url.search = nextSearch;
    replaceState(url, page.state);
  });

  $effect(() => {
    refreshQuerySignature;

    const timeout = setTimeout(() => {
      void refreshLogs();
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  });

  onMount(() => {
    const onWindowKeydown = (event: KeyboardEvent) => {
      if (!asideOpen || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectRelativeLog(-1);
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectRelativeLog(1);
      }
    };

    const syncStateFromLocation = () => {
      const nextState = resolveLogStateFromSearchParams(
        new URL(window.location.href).searchParams,
      );

      live = nextState.live;
      selectedLogId = nextState.selectedLogId;
      asideOpen = Boolean(nextState.selectedLogId);
      time = nextState.time;
      syncEffectiveRange(nextState.time);
      filters = nextState.filters;
    };

    window.addEventListener("keydown", onWindowKeydown);
    window.addEventListener("popstate", syncStateFromLocation);
    return () => {
      window.removeEventListener("keydown", onWindowKeydown);
      window.removeEventListener("popstate", syncStateFromLocation);
    };
  });

  $effect(() => {
    live = data.live;
    selectedLogId = data.selectedLogId;
    asideOpen = Boolean(data.selectedLogId);
    time = data.time;
    filters = data.filters;
    logs = data.logs;
    selectedLogRecord = data.selectedLog;
    selectedLogLoading = false;
    selectedLogRequest += 1;
    volumeBuckets = data.volumeBuckets;
    error = data.error;
    syncEffectiveRange(data.time);
  });

  const markTelemetryViewed = async () => {
    if (telemetryActivationSent) {
      return;
    }

    telemetryActivationSent = true;
    const previousActivation =
      completeOrganizationActivationStep("hasViewedTelemetry");
    const result = await markOrganizationActivationTelemetryViewedCommand({});

    if (result.success === false) {
      telemetryActivationSent = false;
      restoreOrganizationActivation(
        page.data.activeOrganizationId,
        previousActivation,
      );
      return;
    }

    void invalidateAll();
  };

  $effect(() => {
    if (!page.data.organizationActivation) {
      return;
    }

    if (page.data.organizationActivation.hasViewedTelemetry) {
      return;
    }

    if (logs.length === 0) {
      return;
    }

    void markTelemetryViewed();
  });
</script>

<PageContainer title="Logs" bind:asideOpen>
  {#snippet actions()}
    <LiveRefreshButtonGroup bind:live {refresh} />
  {/snippet}

  <div class="flex items-center gap-3 p-3">
    <FilterBuilder
      class="w-full"
      attributes={data.filterAttributes}
      filters={normalizedFilters}
      subjectLabel="logs"
      {loadValueSuggestions}
      onAddFilter={addFilter}
      onRemoveFilter={removeFilter}
    />

    <TimeRangePicker bind:time />
  </div>

  <LogVolumeChart
    buckets={volumeBuckets}
    {loading}
    skeletonBucketCount={resolvedLogVolumeBucketCount}
    start={rangeStart}
    end={rangeEnd}
    {onBucketClick}
  />

  {#if error}
    <div
      class="border-b border-border bg-background px-4 py-3 text-sm text-destructive"
    >
      {error}
    </div>
  {/if}

  <div class="relative flex min-h-0 flex-1 overflow-hidden">
    <LogTable
      {logs}
      {loading}
      {time}
      timezone={logTimezone}
      {selectedLogId}
      {onSelectLog}
    />
  </div>

  {#snippet aside()}
    {#if selectedLog}
      <LogDetailPanel
        log={selectedLog}
        timezone={logTimezone}
        onClose={closeSelectedLog}
      />
    {/if}
  {/snippet}
</PageContainer>
