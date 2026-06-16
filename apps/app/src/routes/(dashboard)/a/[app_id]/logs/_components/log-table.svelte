<script lang="ts">
  import { Label } from "@repo/components/ui/label";
  import { IconDatabase } from "@tabler/icons-svelte";
  import { tick } from "svelte";

  import { normalizeSeverity } from "$lib/utils/normalize-severity";
  import { cn } from "@repo/components";
  import { Badge } from "@repo/components/ui/badge";
  import { Skeleton } from "@repo/components/ui/skeleton";
  import type { LogRecord, LogTimeFilter } from "../types";
  import LogDetailPanel from "./log-detail-panel.svelte";
  import SeverityCell from "./severity-cell.svelte";
  import TimeCell from "./time-cell.svelte";

  let {
    logs = [],
    time,
    timezone,
    loading,
  }: {
    logs: LogRecord[];
    time: LogTimeFilter;
    timezone: string;
    loading: boolean;
  } = $props();

  let selectedLog = $state<LogRecord | null>(null);
  let scrollViewport = $state<HTMLDivElement | null>(null);
  let showTopShadow = $state(false);
  let showBottomShadow = $state(false);

  function selectLog(log: LogRecord) {
    selectedLog = selectedLog === log ? null : log;
  }

  function updateScrollShadows() {
    if (!scrollViewport) {
      showTopShadow = false;
      showBottomShadow = false;
      return;
    }

    const { scrollTop, clientHeight, scrollHeight } = scrollViewport;
    showTopShadow = scrollTop > 1;
    showBottomShadow = scrollTop + clientHeight < scrollHeight - 1;
  }

  const tz = $derived(timezone);

  $effect(() => {
    logs.length;

    void tick().then(() => {
      updateScrollShadows();
    });
  });
</script>

<div class="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
  <div
    class="flex shrink-0 items-center gap-0 border-b bg-secondary py-1.5 pt-3 pr-3 pl-3 tracking-wide text-muted-foreground uppercase"
    role="row"
  >
    <Label class="mr-1.5 ml-1 w-36 shrink-0 text-xs font-normal">Time</Label>
    <Label class="mr-3 w-16 shrink-0 text-xs font-normal">Severity</Label>
    <Label class="mr-3 w-40 shrink-0 text-xs font-normal">Service</Label>
    <Label class="flex-1 text-xs font-normal">Message</Label>
  </div>

  <div class="relative min-h-0 flex-1">
    <div
      class={cn(
        "flex h-full min-h-0 flex-col gap-0.5 overflow-y-auto p-1.5",
        loading && logs.length === 0 && "pointer-events-none",
      )}
      role="rowgroup"
      bind:this={scrollViewport}
      onscroll={updateScrollShadows}
    >
      {#if loading && logs.length === 0}
        {#each Array(100) as _, i}
          <Skeleton
            class="flex min-h-7 rounded-md {i % 2 === 0 && 'bg-background'}"
          />
        {/each}
      {:else if logs.length === 0}
        <div
          class="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground"
        >
          <IconDatabase class="size-8 opacity-30" />
          <div class="text-center">
            <p class="text-sm font-medium text-foreground">
              No logs to display
            </p>
            <p class="mt-0.5 text-xs">This query returned no log records.</p>
          </div>
        </div>
      {:else}
        {#each logs as log, i (log.timestamp + log.span_id + i)}
          {@const severity = normalizeSeverity(
            log.severity_number,
            log.severity_text,
          )}
          <div
            data-selected={selectedLog?.id === log.id}
            class={cn(
              "group flex cursor-pointer items-start gap-0 rounded-md py-1 pr-3 pl-3 transition-colors hover:brightness-95",
              {
                fatal:
                  "bg-destructive/10 text-destructive data-[selected=true]:bg-destructive/20",
                error:
                  "bg-destructive/8 text-destructive data-[selected=true]:bg-destructive/18",
                warn: "bg-amber-500/8 text-amber-500 data-[selected=true]:bg-amber-500/18",
                info: cn(
                  "text-primary data-[selected=true]:bg-muted/70",
                  i % 2 === 0 ? "bg-background" : "bg-muted/65",
                ),
                debug: cn(
                  "text-muted-foreground data-[selected=true]:bg-muted/70",
                  i % 2 === 0 ? "bg-background" : "bg-muted/65",
                ),
                trace: cn(
                  "text-muted-foreground/60 data-[selected=true]:bg-muted/70",
                  i % 2 === 0 ? "bg-background" : "bg-muted/65",
                ),
                unknown: cn(
                  "text-muted-foreground data-[selected=true]:bg-muted/70",
                  i % 2 === 0 ? "bg-background" : "bg-muted/65",
                ),
              }[severity],
            )}
            onclick={() => selectLog(log)}
            onkeydown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectLog(log);
              }
            }}
            role="row"
            tabindex="0"
            aria-selected={selectedLog === log}
          >
            <div
              class="mt-0.5 mr-1.5 flex w-36 shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
            >
              <TimeCell date={new Date(log.timestamp)} {time} />
            </div>

            <SeverityCell
              severityNumber={log.severity_number}
              severityText={log.severity_text}
            />

            <div class="mt-0.5 mr-3 w-40 shrink-0">
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

            <div class="mt-0.5 flex min-w-0 flex-1 flex-col items-start gap-1">
              <span
                class="font-mono text-xs leading-relaxed break-all text-secondary-foreground"
              >
                {log.body}
              </span>
              {#if Object.keys(log.log_attributes ?? {}).length > 0}
                <div class="flex flex-wrap gap-1">
                  {#each Object.entries(log.log_attributes) as [key, value]}
                    <Badge
                      variant="outline"
                      class="h-auto gap-0.5 rounded-md px-1.5 py-[1px] text-[11px] font-normal"
                    >
                      <span class="text-muted-foreground">{key}:</span>
                      <span class="text-foreground">{value}</span>
                    </Badge>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-linear-to-b from-border/60 to-transparent transition-opacity duration-500"
      class:opacity-0={!showTopShadow}
      class:opacity-100={showTopShadow}
    ></div>
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-linear-to-t from-border/60 to-transparent transition-opacity duration-500"
      class:opacity-0={!showBottomShadow}
      class:opacity-100={showBottomShadow}
    ></div>
  </div>

  {#if selectedLog}
    <div
      class="absolute inset-y-0 top-[35px] right-0 z-20 flex w-120 flex-col border-l shadow-xl"
    >
      <LogDetailPanel
        log={selectedLog}
        timezone={tz}
        onClose={() => (selectedLog = null)}
      />
    </div>
  {/if}
</div>
