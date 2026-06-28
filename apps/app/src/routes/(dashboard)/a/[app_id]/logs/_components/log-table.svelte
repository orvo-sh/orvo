<script lang="ts">
  import { Badge } from "@repo/components/ui/badge";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { Label } from "@repo/components/ui/label";
  import { Spinner } from "@repo/components/ui/spinner";
  import { tick } from "svelte";

  import { resolveTimeFilter, type TimeFilter } from "$lib/core/time-filter";
  import { normalizeSeverity } from "$lib/utils/normalize-severity";
  import { cn } from "@repo/components";
  import { Skeleton } from "@repo/components/ui/skeleton";
  import TimeCell from "../../_components/time-cell.svelte";
  import type { LogRecord } from "../types";
  import LogAttributeChip from "./log-attribute-chip.svelte";
  import { buildLogAttributeChips } from "./log-attribute-display";
  import SeverityCell from "./severity-cell.svelte";

  let {
    logs = [],
    time,
    loading,
    loadingMore = false,
    selectedLogId = null,
    onReachEnd,
    onSelectLog,
  }: {
    logs: LogRecord[];
    time: TimeFilter;
    timezone: string;
    loading: boolean;
    loadingMore?: boolean;
    selectedLogId?: string | null;
    onReachEnd?: () => void;
    onSelectLog: (log: LogRecord) => void;
  } = $props();

  let scrollViewport = $state<HTMLDivElement | null>(null);
  let showTopShadow = $state(false);
  let showBottomShadow = $state(false);
  const MAX_VISIBLE_ATTRIBUTE_CHIPS = 5;
  const LOAD_MORE_THRESHOLD_PX = 160;
  const showLoadingOverlay = $derived(loading);

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
    logs.length;

    void tick().then(() => {
      updateScrollShadows();
    });
  });

  $effect(() => {
    selectedLogId;

    void tick().then(() => {
      if (!selectedLogId || !scrollViewport) {
        return;
      }

      const selectedRow = scrollViewport.querySelector<HTMLElement>(
        `[data-log-id="${selectedLogId}"]`,
      );
      selectedRow?.scrollIntoView({
        block: "nearest",
      });
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
        class={cn(
          "flex h-full min-h-0 flex-col divide-y overflow-y-auto transition-opacity duration-200",
          loading && logs.length === 0 && "pointer-events-none",
          showLoadingOverlay && "opacity-70",
        )}
        role="rowgroup"
        bind:this={scrollViewport}
        onscroll={updateScrollShadows}
      >
        {#if loading && logs.length === 0}
          {#each Array(100) as _, i}
            <Skeleton
              class="flex min-h-7 rounded-none {i % 2 === 0 && 'bg-background'}"
            />
          {/each}
        {:else if logs.length === 0}
          <div
            class="flex flex-col items-center pt-[5%] text-sm text-muted-foreground"
          >
            No logs to display.
          </div>
        {:else}
          {#each logs as log, i (log.timestamp + log.span_id + i)}
            {@const severity = normalizeSeverity(
              log.severity_number,
              log.severity_text,
            )}
            {@const attributeChips = buildLogAttributeChips(log)}
            {@const visibleAttributeChips = attributeChips.slice(
              0,
              MAX_VISIBLE_ATTRIBUTE_CHIPS,
            )}
            {@const hiddenAttributeChips = attributeChips.slice(
              MAX_VISIBLE_ATTRIBUTE_CHIPS,
            )}
            <div
              data-log-id={log.id}
              data-testid="logs-table-row"
              data-selected={selectedLogId === log.id}
              class={cn(
                "group flex cursor-pointer items-start gap-0 py-1 pr-3 pl-3 transition-colors",
                {
                  fatal:
                    "bg-destructive/10 text-destructive data-[selected=true]:bg-destructive/20",
                  error:
                    "bg-destructive/8 text-destructive hover:bg-destructive/18 data-[selected=true]:bg-destructive/18",
                  warn: "bg-amber-500/8 text-amber-500 hover:bg-amber-500/18 data-[selected=true]:bg-amber-500/18",
                  info: cn(
                    "text-primary hover:bg-muted data-[selected=true]:bg-muted",
                  ),
                  debug: cn(
                    "text-muted-foreground hover:bg-muted data-[selected=true]:bg-muted",
                  ),
                  trace: cn(
                    "text-muted-foreground/60 hover:bg-muted data-[selected=true]:bg-muted",
                  ),
                  unknown: cn(
                    "text-muted-foreground hover:bg-muted data-[selected=true]:bg-muted",
                  ),
                }[severity],
              )}
              onclick={() => onSelectLog(log)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectLog(log);
                }
              }}
              role="row"
              tabindex="0"
              aria-selected={selectedLogId === log.id}
            >
              <div
                class="mt-0.5 mr-1.5 flex w-36 shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
              >
                <TimeCell
                  date={new Date(log.timestamp)}
                  rangeMs={(() => {
                    const t = resolveTimeFilter(time);
                    return Math.max(
                      Math.abs(t.end.getTime() - t.start.getTime()),
                      1,
                    );
                  })()}
                />
              </div>

              <SeverityCell
                severityNumber={log.severity_number}
                severityText={log.severity_text}
              />

              <div class="mt-0.5 mr-3 hidden w-40 shrink-0 lg:block">
                <span
                  class="block truncate font-mono text-xs text-secondary-foreground"
                >
                  {#if log.service_name}
                    {log.service_name}
                  {:else}
                    -
                  {/if}
                </span>
              </div>

              <div
                class="mt-0.5 flex min-w-0 flex-1 flex-col items-start gap-1"
              >
                <span
                  class="font-mono text-xs leading-relaxed break-all text-secondary-foreground"
                >
                  {log.body}
                </span>
                {#if attributeChips.length > 0}
                  <div class="flex flex-wrap gap-1">
                    {#each visibleAttributeChips as chip}
                      <LogAttributeChip
                        label={chip.key}
                        value={chip.value}
                        fullValue={chip.fullValue}
                      />
                    {/each}
                    {#if hiddenAttributeChips.length > 0}
                      <HoverCard.Root openDelay={50} closeDelay={50}>
                        <HoverCard.Trigger
                          type="button"
                          class="text-left"
                          onclick={(event) => event.stopPropagation()}
                          onkeydown={(event) => event.stopPropagation()}
                        >
                          <Badge
                            variant="outline"
                            class="h-6 h-auto max-w-full gap-0.5 rounded-md border-foreground/10 bg-linear-to-t from-secondary to-transparent px-1.5 py-[1px] text-[11px] font-normal inset-shadow-[0px_1px_--theme(--color-white)]"
                          >
                            +{hiddenAttributeChips.length}
                          </Badge>
                        </HoverCard.Trigger>
                        <HoverCard.Content
                          class="w-96 max-w-[min(32rem,90vw)] p-2"
                        >
                          <div class="max-h-80 overflow-auto text-xs">
                            <div class="flex flex-wrap items-center gap-1">
                              {#each hiddenAttributeChips as chip, index}
                                <LogAttributeChip
                                  label={chip.key}
                                  value={chip.value}
                                  fullValue={chip.fullValue}
                                />
                                {#if index < hiddenAttributeChips.length - 1}
                                  <span class="text-muted-foreground">,</span>
                                {/if}
                              {/each}
                            </div>
                          </div>
                        </HoverCard.Content>
                      </HoverCard.Root>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
          {#if loadingMore}
            <div
              data-testid="logs-table-loading-more"
              class="flex items-center justify-center gap-2 px-3 py-3 text-sm text-muted-foreground"
            >
              <Spinner class="size-4" />
              Loading more logs
            </div>
          {/if}
        {/if}
      </div>

      {#if showLoadingOverlay}
        <div
          class="pointer-events-none absolute inset-0 z-10 bg-background/10"
          aria-hidden="true"
        ></div>
      {/if}

      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-4 bg-linear-to-b from-border/60 to-transparent transition-opacity duration-500"
        class:opacity-0={!showTopShadow}
        class:opacity-100={showTopShadow}
      ></div>
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-linear-to-t from-border/60 to-transparent transition-opacity duration-500"
        class:opacity-0={!showBottomShadow}
        class:opacity-100={showBottomShadow}
      ></div>
    </div>
  </div>
</div>
