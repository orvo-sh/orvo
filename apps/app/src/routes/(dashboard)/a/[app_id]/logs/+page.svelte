<script lang="ts">
  import { onMount } from "svelte";

  import { FilterBuilder } from "../_components/filter-builder";
  import LiveRefreshButtonGroup from "../_components/live-refresh-button-group.svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import TimeRangePicker from "../_components/time-range-picker.svelte";
  import LogDetailPanel from "./_components/log-detail-panel.svelte";
  import LogTable from "./_components/log-table.svelte";
  import LogVolumeChart from "./_components/log-volume-chart.svelte";
  import LogsPageState from "./page-state.svelte";

  let { data } = $props();

  const state = new LogsPageState(() => data);

  onMount(state.mount);
</script>

<PageContainer
  title="Logs"
  asideTitle={state.selectedLog?.id}
  bind:asideOpen={state.asideOpen}
>
  {#snippet actions()}
    <LiveRefreshButtonGroup
      bind:live={state.live}
      refresh={state.refreshLogs}
      disabled={state.time.kind == "range"}
    />
  {/snippet}

  {#snippet aside()}
    {#if state.selectedLog}
      <LogDetailPanel
        log={state.selectedLog}
        timezone={state.logTimezone}
        onClose={state.closeSelectedLog}
      />
    {/if}
  {/snippet}

  <div data-testid="logs-toolbar" class="flex items-center gap-3 p-3">
    <FilterBuilder
      class="w-full"
      attributes={data.filterAttributes}
      filters={state.normalizedFilters}
      subjectLabel="logs"
      loadValueSuggestions={state.loadValueSuggestions}
      onAddFilter={state.addFilter}
      onRemoveFilter={state.removeFilter}
    />

    <TimeRangePicker
      bind:time={state.time}
      onApply={() => {
        state.live = false;
      }}
    />
  </div>

  <div data-testid="logs-volume-chart-container" class="not-md:hidden">
    <LogVolumeChart
      buckets={state.volumeBuckets}
      loading={state.loading}
      skeletonBucketCount={state.resolvedLogVolumeBucketCount}
      start={state.rangeStart}
      end={state.rangeEnd}
      onBucketClick={state.onBucketClick}
    />
  </div>

  <div
    data-testid="logs-content"
    class="relative flex min-h-0 w-full flex-1 overflow-hidden"
  >
    <LogTable
      logs={state.logs}
      loading={state.loading}
      loadingMore={state.loadingMore}
      time={state.time}
      timezone={state.logTimezone}
      selectedLogId={state.selectedLogId}
      onReachEnd={state.loadMoreLogs}
      onSelectLog={state.onSelectLog}
    />
  </div>
</PageContainer>
