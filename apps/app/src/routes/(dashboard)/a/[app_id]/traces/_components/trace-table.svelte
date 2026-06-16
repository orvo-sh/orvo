<script lang="ts">
  import { Label } from "@repo/components/ui/label";
  import {
    IconRefresh as ArrowsClockwiseIcon,
    IconBinaryTree2 as TreeStructureIcon,
  } from "@tabler/icons-svelte";

  import type { ActiveFilter, TraceRow as TraceRowType } from "../types";
  import TraceRow from "./trace-row.svelte";

  let {
    traces = [],
    loading = false,
    onAddFilter,
    rangeStart,
    rangeEnd,
  }: {
    traces?: TraceRowType[];
    loading?: boolean;
    onAddFilter: (filter: ActiveFilter) => void;
    rangeStart: Date;
    rangeEnd: Date;
  } = $props();

  let scrollViewport = $state<HTMLDivElement | null>(null);
  let hovered = $state(false);
  let showTopShadow = $state(false);
  let showBottomShadow = $state(false);
  let canScroll = $state(false);

  function updateScrollShadows() {
    if (!scrollViewport) {
      showTopShadow = false;
      showBottomShadow = false;
      canScroll = false;
      return;
    }

    const { scrollTop, clientHeight, scrollHeight } = scrollViewport;
    canScroll = scrollHeight > clientHeight + 1;
    showTopShadow = scrollTop > 1;
    showBottomShadow = scrollTop + clientHeight < scrollHeight - 1;
  }

  $effect(() => {
    traces;

    queueMicrotask(() => {
      updateScrollShadows();
    });
  });
</script>

<div class="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
  <div
    class="flex shrink-0 items-center gap-0 border-b bg-secondary py-1.5 pr-3 pl-3 tracking-wide text-muted-foreground uppercase"
    role="row"
  >
    <Label class="w-4 shrink-0 text-xs"></Label>
    <Label class="mr-1.5 w-36 shrink-0 text-xs font-normal">Time</Label>
    <Label class="mr-3 min-w-0 flex-1 text-xs font-normal">Trace</Label>
    <Label class="mr-3 w-32 shrink-0 text-xs font-normal">Service</Label>
    <Label class="mr-3 w-20 shrink-0 text-xs font-normal">Duration</Label>
    <Label class="w-16 shrink-0 text-xs font-normal">Spans</Label>
  </div>
  <div class="relative min-h-0 flex-1">
    <div
      bind:this={scrollViewport}
      class="flex h-full min-h-0 flex-col gap-0.5 overflow-y-auto p-1.5"
      role="rowgroup"
      onscroll={updateScrollShadows}
      onmouseenter={() => {
        hovered = true;
        updateScrollShadows();
      }}
      onmouseleave={() => {
        hovered = false;
      }}
    >
      {#if loading}
        <div
          class="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground"
        >
          <ArrowsClockwiseIcon class="size-5 animate-spin" />
          <span class="text-sm">Loading traces…</span>
        </div>
      {:else if traces.length === 0}
        <div
          class="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground"
        >
          <TreeStructureIcon class="size-8 opacity-30" />
          <div class="text-center">
            <p class="text-sm font-medium text-foreground">No traces found</p>
            <p class="mt-0.5 text-xs">
              Try adjusting your filters or time range.
            </p>
          </div>
        </div>
      {:else}
        {#each traces as trace, index (trace.trace_id)}
          <TraceRow {trace} {index} {onAddFilter} {rangeStart} {rangeEnd} />
        {/each}
      {/if}
    </div>
  </div>
  <div
    class="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-linear-to-b from-border/60 to-transparent transition-opacity duration-500"
    class:opacity-0={!showTopShadow}
    class:opacity-100={showTopShadow}
  ></div>
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-linear-to-t from-border/60 to-transparent transition-opacity duration-500"
    class:opacity-0={!(showBottomShadow || (hovered && canScroll))}
    class:opacity-100={showBottomShadow || (hovered && canScroll)}
  ></div>
</div>
