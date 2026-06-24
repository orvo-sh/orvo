<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { navigating, page } from "$app/state";
  import { markOrganizationActivationTelemetryViewedCommand } from "$lib/api/organization-activation.remote";
  import { getTraceFilterValueSuggestionsQuery } from "$lib/api/traces.remote";
  import {
    completeOrganizationActivationStep,
    restoreOrganizationActivation,
  } from "$lib/stores/organization-activation.svelte";
  import TraceSearchBar from "../_components/filter-builder/filter-builder.svelte";
  import LiveRefreshButtonGroup from "../_components/live-refresh-button-group.svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import TimeRangePicker from "../logs/_components/time-range-picker.svelte";
  import type { LogTimeFilter } from "../logs/types";
  import TraceTable from "./_components/trace-table.svelte";
  import { createTraceStateSearchParams, resolveTraceTimeRange } from "./state";
  import type { ActiveFilter, TraceFilters } from "./types";

  let { data } = $props();

  let live = $state(false);
  let telemetryActivationSent = $state(false);
  let time = $state<LogTimeFilter>(data.time);
  let filters = $state<TraceFilters>(data.filters);

  const loading = $derived(navigating.to?.url.pathname === page.url.pathname);
  const nextSearch = $derived(
    createTraceStateSearchParams(time, filters).toString(),
  );
  const timeRange = $derived(resolveTraceTimeRange(time));
  const rangeStart = $derived(timeRange.start);
  const rangeEnd = $derived(timeRange.end);

  const addFilter = (filter: ActiveFilter) => {
    const exists = filters.activeFilters.some(
      (value) =>
        value.attribute === filter.attribute &&
        value.operator === filter.operator &&
        value.value === filter.value,
    );

    if (exists) {
      return;
    }

    const nextFilters = [...filters.activeFilters];

    if (
      filter.attribute === "trace.duration" &&
      (filter.operator === "gt" || filter.operator === "gte")
    ) {
      filters = {
        ...filters,
        activeFilters: [
          ...nextFilters.filter(
            (value) =>
              !(
                value.attribute === "trace.duration" &&
                (value.operator === "gt" || value.operator === "gte")
              ),
          ),
          filter,
        ],
      };
      return;
    }

    if (
      filter.attribute === "trace.duration" &&
      (filter.operator === "lt" || filter.operator === "lte")
    ) {
      filters = {
        ...filters,
        activeFilters: [
          ...nextFilters.filter(
            (value) =>
              !(
                value.attribute === "trace.duration" &&
                (value.operator === "lt" || value.operator === "lte")
              ),
          ),
          filter,
        ],
      };
      return;
    }

    filters = {
      ...filters,
      activeFilters: [...nextFilters, filter],
    };
  };

  const removeFilter = (filter: ActiveFilter) => {
    filters = {
      ...filters,
      activeFilters: filters.activeFilters.filter(
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

    await invalidateAll();
  };

  $effect(() => {
    time = data.time;
    filters = data.filters;
  });

  $effect(() => {
    if (!live) {
      return;
    }

    const id = setInterval(() => {
      void refresh();
    }, 5000);

    return () => clearInterval(id);
  });

  $effect(() => {
    if (nextSearch === page.url.searchParams.toString()) {
      return;
    }

    const href = nextSearch
      ? `${page.url.pathname}?${nextSearch}`
      : page.url.pathname;
    void goto(href, {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    });
  });

  $effect(() => {
    if (!page.data.organizationActivation) {
      return;
    }

    if (page.data.organizationActivation.hasViewedTelemetry) {
      return;
    }

    if (data.traces.length === 0) {
      return;
    }

    void markTelemetryViewed();
  });
</script>

<PageContainer title="Traces" class="min-h-0 overflow-hidden" innerClass="p-0!">
  {#snippet actions()}
    <LiveRefreshButtonGroup bind:live {refresh} />
  {/snippet}

  <div class="flex items-center gap-2 bg-secondary p-2 px-3">
    <div class="min-w-0 flex-1">
      <TraceSearchBar
        attributes={data.filterAttributes}
        filters={filters.activeFilters}
        subjectLabel="traces"
        loadValueSuggestions={(input) =>
          getTraceFilterValueSuggestionsQuery(input).run()}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
      />
    </div>
    <TimeRangePicker bind:time />
  </div>

  {#if data.error}
    <div
      class="border-b border-border bg-background px-4 py-3 text-sm text-destructive"
    >
      {data.error}
    </div>
  {/if}

  <TraceTable
    traces={data.traces}
    {loading}
    onAddFilter={addFilter}
    {rangeStart}
    {rangeEnd}
  />
</PageContainer>
