<script lang="ts">
  import { onMount } from "svelte";

  import { FilterBuilder } from "../_components/filter-builder";
  import LiveRefreshButtonGroup from "../_components/live-refresh-button-group.svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import TimeRangePicker from "../_components/time-range-picker.svelte";
  import TraceSortControls from "./_components/trace-sort-controls.svelte";
  import { TraceTable } from "./_components/trace-table";
  import TracesPageState from "./page-state.svelte";

  let { data } = $props();
  const state = new TracesPageState(() => data);
  onMount(state.mount);
</script>

<PageContainer title="Traces">
  {#snippet actions()}
    <LiveRefreshButtonGroup
      bind:live={state.live}
      refresh={state.refreshTraces}
      disabled={state.timeFilter.kind == "range"}
    />
  {/snippet}

  <div
    data-testid="traces-toolbar"
    class="flex min-w-0 items-center gap-1.5 p-3"
  >
    <FilterBuilder
      class="min-w-0 flex-1"
      attributes={data.filterAttributes}
      filters={state.normalizedFilters}
      subjectLabel="traces"
      loadValueSuggestions={state.loadValueSuggestions}
      onAddFilter={state.addFilter}
      onRemoveFilter={state.removeFilter}
    />
    <TraceSortControls
      bind:sortBy={state.sortBy}
      bind:sortOrder={state.sortOrder}
    />
    <TimeRangePicker
      bind:time={state.timeFilter}
      onApply={() => {
        state.live = false;
      }}
    />
  </div>

  <div
    data-testid="trace-content"
    class="relative flex min-h-0 w-full flex-1 overflow-hidden"
  >
    <TraceTable
      traces={state.traces}
      loading={state.loading}
      onReachEnd={state.loadMoreTraces}
      timeFilter={state.timeFilter}
      sortBy={state.sortBy}
    />
  </div>
</PageContainer>
