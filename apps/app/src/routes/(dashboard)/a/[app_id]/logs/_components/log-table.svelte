<script lang="ts">
  import { resolveTimeFilter, type TimeFilter } from "$lib/core/time-filter";
  import { cn } from "@repo/components";
  import { Badge } from "@repo/components/ui/badge";
  import { Label } from "@repo/components/ui/label";
  import { Skeleton } from "@repo/components/ui/skeleton";
  import { Spinner } from "@repo/components/ui/spinner";
  import { tick } from "svelte";

  import type { LogRecord, LogSortBy } from "../types";
  import { generateLogTableGroups } from "./log-table-groups";
  import LogTableRow from "./log-table-row.svelte";

  let {
    logs = [],
    time,
    sortBy,
    loading,
    loadingMore = false,
    selectedLogId = null,
    onReachEnd,
    onSelectLog,
  }: {
    logs: LogRecord[];
    time: TimeFilter;
    sortBy: LogSortBy;
    loading: boolean;
    loadingMore?: boolean;
    selectedLogId?: string | null;
    onReachEnd?: () => void;
    onSelectLog: (log: LogRecord) => void;
  } = $props();

  let scrollViewport = $state<HTMLDivElement | null>(null);
  let showTopShadow = $state(false);
  let showBottomShadow = $state(false);

  const LOAD_MORE_THRESHOLD_PX = 160;
  const showLoadingOverlay = $derived(loading);
  const rangeMs = $derived.by(() => {
    const { start, end } = resolveTimeFilter(time);
    return Math.max(Math.abs(end.getTime() - start.getTime()), 1);
  });
  const showGroups = $derived(sortBy === "timestamp");
  const logGroups = $derived.by(() => generateLogTableGroups(logs, time));

  const updateScrollShadows = () => {
    if (!scrollViewport) {
      showTopShadow = false;
      showBottomShadow = false;
      return;
    }

    const { scrollTop, clientHeight, scrollHeight } = scrollViewport;
    showTopShadow = scrollTop > 1;
    showBottomShadow = scrollTop + clientHeight < scrollHeight - 1;

    if (scrollTop + clientHeight >= scrollHeight - LOAD_MORE_THRESHOLD_PX) {
      onReachEnd?.();
    }
  };

  $effect(() => {
    void logs.length;
    void showGroups;
    void logGroups.length;

    void tick().then(() => {
      updateScrollShadows();
    });
  });

  $effect(() => {
    void selectedLogId;

    void tick().then(() => {
      if (!selectedLogId || !scrollViewport) {
        return;
      }

      const selectedRow = scrollViewport.querySelector<HTMLElement>(
        `[data-log-id="${selectedLogId}"]`,
      );
      selectedRow?.scrollIntoView({ block: "nearest" });
    });
  });
</script>

<div data-testid="logs-table" class="h-full min-h-0 w-full overflow-x-auto">
  <div
    class="relative flex h-full min-h-0 min-w-[42rem] flex-1 flex-col overflow-hidden lg:min-w-[52rem]"
  >
    <div
      class="flex shrink-0 items-center gap-0 border-b px-2 py-1.5 pt-3 tracking-wide text-muted-foreground uppercase"
      role="row"
    >
      <Label class="mr-1.5 ml-1 w-36 shrink-0 text-xs font-normal">Time</Label>
      <Label class="mr-3 w-16 shrink-0 text-xs font-normal">Severity</Label>
      <Label class="mr-3 hidden w-40 shrink-0 text-xs font-normal lg:block"
        >Service</Label
      >
      <Label class="flex-1 text-xs font-normal">Message</Label>
    </div>

    <div class="relative min-h-0 flex-1">
      <div
        data-testid="logs-table-scroll-viewport"
        bind:this={scrollViewport}
        class={cn(
          "flex h-full min-h-0 flex-col overflow-y-auto transition-opacity duration-200",
          loading && logs.length === 0 && "pointer-events-none",
          showLoadingOverlay && "opacity-70",
        )}
        role="rowgroup"
        onscroll={updateScrollShadows}
      >
        {#if loading && logs.length === 0}
          {#each Array.from({ length: 100 }, (_, index) => index) as index (index)}
            <Skeleton
              class={cn(
                "flex min-h-7 rounded-none",
                index % 2 === 0 && "bg-background",
              )}
            />
          {/each}
        {:else if logs.length === 0}
          <div
            class="flex flex-col items-center pt-[5%] text-sm text-muted-foreground"
          >
            No logs to display.
          </div>
        {:else if showGroups}
          {#each logGroups as group (group.key)}
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
                    class="h-6 max-w-full gap-0.5 rounded-md border-foreground/10 bg-linear-to-t from-secondary to-transparent p-0 px-1.5 py-px text-[11px] font-normal inset-shadow-[0px_1px_--theme(--color-white)]"
                  >
                    {group.label}
                  </Badge>
                </div>
              </div>

              <div class="divide-y">
                {#each group.logs as log, index (log.id ?? `${group.key}:${index}`)}
                  <LogTableRow
                    {log}
                    {rangeMs}
                    selected={selectedLogId === log.id}
                    {onSelectLog}
                  />
                {/each}
              </div>
            </div>
          {/each}
        {:else}
          <div class="divide-y">
            {#each logs as log, index (log.id ?? `${log.timestamp}:${index}`)}
              <LogTableRow
                {log}
                {rangeMs}
                selected={selectedLogId === log.id}
                {onSelectLog}
              />
            {/each}
          </div>
        {/if}

        {#if loadingMore}
          <div
            data-testid="logs-table-loading-more"
            class="flex items-center justify-center gap-2 px-3 py-3 text-sm text-muted-foreground"
          >
            <Spinner class="size-4" />
            Loading more logs
          </div>
        {/if}
      </div>

      {#if showLoadingOverlay}
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
