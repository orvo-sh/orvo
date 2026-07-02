<script lang="ts">
  import { type TimeFilter } from "$lib/core/time-filter";
  import { cn } from "@repo/components";
  import { Label } from "@repo/components/ui/label";
  import { Skeleton } from "@repo/components/ui/skeleton";
  import { Spinner } from "@repo/components/ui/spinner";
  import { tick } from "svelte";

  import { Badge } from "@repo/components/ui/badge";
  import type { Span } from "../../types";
  import { generateTraceTableGroups } from "./trace-table-groups";
  import TraceTableRow from "./trace-table-row.svelte";

  let {
    traces = [],
    loading = false,
    onReachEnd,
    timeFilter,
    sortBy,
  }: {
    traces?: Span[];
    loading?: boolean;
    onReachEnd?: () => void;
    timeFilter: TimeFilter;
    sortBy: "start_time" | "duration" | "span_count" | "trace_name";
  } = $props();

  let scrollViewport = $state<HTMLDivElement | null>(null);
  let showTopShadow = $state(false);
  let showBottomShadow = $state(false);

  const showGroups = $derived(sortBy === "start_time");

  let traceGroups = $derived.by(() =>
    generateTraceTableGroups(traces, timeFilter),
  );

  const updateScrollShadows = () => {
    if (!scrollViewport) {
      showTopShadow = false;
      showBottomShadow = false;
      return;
    }

    const { scrollTop, clientHeight, scrollHeight } = scrollViewport;

    showTopShadow = scrollTop > 1;
    showBottomShadow = scrollTop + clientHeight < scrollHeight - 1;

    if (scrollTop + clientHeight >= scrollHeight - 160) {
      onReachEnd?.();
    }
  };

  $effect(() => {
    void traces.length;
    void showGroups;
    void traceGroups.length;
    void timeFilter;

    void tick().then(() => {
      updateScrollShadows();
    });
  });
</script>

<div class="h-full min-h-0 w-full overflow-x-auto">
  <div
    class="relative flex h-full min-h-0 min-w-180 flex-1 flex-col overflow-hidden lg:min-w-4xl"
  >
    <div
      class="flex shrink-0 items-center border-b py-1.5 pr-3 pl-0 tracking-wide text-muted-foreground uppercase"
      role="row"
    >
      <Label class="mr-3 w-3 shrink-0 text-xs font-normal"></Label>
      <Label class="mr-3 w-36 shrink-0 text-xs font-normal">Time</Label>
      <Label class="mr-3 min-w-0 flex-1 pl-0 text-xs font-normal">Trace</Label>
      <Label class="mr-3 hidden w-40 shrink-0 text-xs font-normal lg:block"
        >Service(s)</Label
      >
      <Label class="mr-3 w-20 shrink-0 text-xs font-normal">Duration</Label>
      <Label class="w-16 shrink-0 text-xs font-normal">Spans</Label>
    </div>

    <div class="relative min-h-0 flex-1">
      <div
        bind:this={scrollViewport}
        class={cn(
          "flex h-full min-h-0 flex-col overflow-y-auto transition-opacity duration-200",
          loading && traces.length === 0 && "pointer-events-none",
          loading && traces.length > 0 && "opacity-70",
        )}
        role="rowgroup"
        onscroll={updateScrollShadows}
      >
        {#if loading && traces.length === 0}
          {#each Array.from({ length: 100 }, (_, index) => index) as index (index)}
            <Skeleton class="flex min-h-11 rounded-none bg-background" />
          {/each}
        {:else if traces.length === 0}
          <div
            class="flex flex-col items-center pt-[5%] text-sm text-muted-foreground"
          >
            No traces to display.
          </div>
        {:else if showGroups}
          {#each traceGroups as group (group.key)}
            <div>
              <div
                class="relative h-8 shrink-0"
                role="separator"
                aria-label={group.label}
              >
                <div class="absolute inset-x-0 top-1/2 border-t"></div>

                <div
                  class="absolute top-1/2 left-4 -translate-y-1/2 rounded-md bg-card"
                >
                  <Badge
                    variant="outline"
                    class=" h-6 max-w-full gap-0.5  rounded-md border-foreground/10 bg-linear-to-t from-secondary to-transparent p-0 px-1.5 py-px text-[11px] font-normal inset-shadow-[0px_1px_--theme(--color-white)]"
                  >
                    {group.label}
                  </Badge>
                </div>
              </div>

              <div class="divide-y">
                {#each group.traces as trace (trace.id)}
                  <TraceTableRow {trace} {timeFilter} />
                {/each}
              </div>
            </div>
          {/each}
        {:else}
          <div class="divide-y">
            {#each traces as trace (trace.id)}
              <TraceTableRow {trace} {timeFilter} />
            {/each}
          </div>
        {/if}

        {#if loading && traces.length > 0}
          <div
            class="flex items-center justify-center gap-2 px-3 py-3 text-sm text-muted-foreground"
          >
            <Spinner class="size-4" />
            Loading more traces
          </div>
        {/if}
      </div>

      {#if loading && traces.length > 0}
        <div
          class="pointer-events-none absolute inset-0 z-10 bg-background/10"
          aria-hidden="true"
        ></div>
      {/if}

      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-2 bg-linear-to-b from-border/60 via-transparent to-transparent transition-opacity duration-500"
        class:opacity-0={!showTopShadow}
        class:opacity-100={showTopShadow}
      ></div>

      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-linear-to-t from-border/60 via-transparent to-transparent transition-opacity duration-500"
        class:opacity-0={!showBottomShadow}
        class:opacity-100={showBottomShadow}
      ></div>
    </div>
  </div>
</div>
