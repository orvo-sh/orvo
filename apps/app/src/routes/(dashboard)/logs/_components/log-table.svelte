<script lang="ts">
  import { Label } from "@repo/components/ui/label";
  import { IconDatabase } from "@tabler/icons-svelte";
  import { tick } from "svelte";
  import { fly } from "svelte/transition";

  import { normalizeSeverity } from "$lib/utils/normalize-severity";
  import { cn } from "@repo/components";
  import { Skeleton } from "@repo/components/ui/skeleton";
  import type { LogRecord, LogTimeFilter } from "../types";
  import LogDetailPanel from "./log-detail-panel.svelte";
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
    class="flex shrink-0 items-center gap-0 border-b bg-secondary py-1.5 pt-3 pr-3 pl-4 tracking-wide text-muted-foreground"
    role="row"
  >
    <Label class="mr-3 w-40 shrink-0 font-normal">Time</Label>
    <Label class="mr-3 w-16 shrink-0 font-normal">Severity</Label>
    <Label class="mr-3 w-40 shrink-0 font-normal">Service</Label>
    <Label class="flex-1 font-normal">Message</Label>
  </div>

  <div class="relative min-h-0 flex-1">
    <div
      class={cn(
        "flex h-full min-h-0 flex-col gap-1 overflow-y-auto p-2 py-1",
        loading && logs.length === 0 && "pointer-events-none",
      )}
      role="rowgroup"
      bind:this={scrollViewport}
      onscroll={updateScrollShadows}
    >
      {#if loading && logs.length === 0}
        {#each Array(100) as _, i}
          <Skeleton
            class="flex min-h-8 rounded-none {i % 2 === 0 && 'bg-background'}"
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
              "group flex min-h-8 cursor-pointer items-start gap-0 rounded-md py-1.5 pr-3 pl-4 transition-colors hover:brightness-95",
              {
                fatal:
                  "bg-destructive/10 text-destructive data-[selected=true]:bg-destructive/20",
                error:
                  "bg-destructive/8 text-destructive data-[selected=true]:bg-destructive/18",
                warn: "bg-amber-500/8 text-amber-500 data-[selected=true]:bg-amber-500/18",
                info: cn(
                  "text-primary data-[selected=true]:bg-muted/70",
                  i % 2 === 0 ? "bg-background" : "bg-muted/55",
                ),
                debug: cn(
                  "text-muted-foreground data-[selected=true]:bg-muted/70",
                  i % 2 === 0 ? "bg-background" : "bg-muted/55",
                ),
                trace: cn(
                  "text-muted-foreground/60 data-[selected=true]:bg-muted/70",
                  i % 2 === 0 ? "bg-background" : "bg-muted/55",
                ),
                unknown: cn(
                  "text-muted-foreground data-[selected=true]:bg-muted/70",
                  i % 2 === 0 ? "bg-background" : "bg-muted/55",
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
              class="mt-0.5 mr-3 flex w-40 shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
            >
              <TimeCell
                date={new Date(log.timestamp)}
                range={time.kind === "range"
                  ? {
                      start: new Date(time.startAtUtc),
                      end: new Date(time.endAtUtc),
                    }
                  : ((preset) => {
                      const end = new Date();
                      switch (preset) {
                        case "last_hour":
                          return {
                            start: new Date(end.getTime() - 60 * 60 * 1000),
                            end,
                          };
                        case "today": {
                          const start = new Date(end);
                          start.setHours(0, 0, 0, 0);
                          return { start, end };
                        }
                        case "last_24_hours":
                          return {
                            start: new Date(
                              end.getTime() - 24 * 60 * 60 * 1000,
                            ),
                            end,
                          };
                        case "last_3_days":
                          return {
                            start: new Date(
                              end.getTime() - 3 * 24 * 60 * 60 * 1000,
                            ),
                            end,
                          };
                        case "last_7_days":
                          return {
                            start: new Date(
                              end.getTime() - 7 * 24 * 60 * 60 * 1000,
                            ),
                            end,
                          };
                        case "last_2_weeks":
                          return {
                            start: new Date(
                              end.getTime() - 14 * 24 * 60 * 60 * 1000,
                            ),
                            end,
                          };
                        case "last_month":
                          return {
                            start: new Date(
                              end.getTime() - 30 * 24 * 60 * 60 * 1000,
                            ),
                            end,
                          };
                      }
                    })(time.preset)}
              />
            </div>

            <div
              class="mt-0.5 mr-3 flex w-16 shrink-0 items-center gap-1.5 uppercase"
            >
              <span
                class="w-12 shrink-0 text-xs font-normal"
                title={log.severity_text}
              >
                {severity}
              </span>
            </div>

            <div class="mt-0.5 mr-3 w-40 shrink-0">
              <span class="block truncate font-mono text-xs text-foreground">
                {#if log.service_name}
                  {log.service_name}
                {:else}
                  Unknown
                {/if}
              </span>
            </div>

            <div class="flex min-w-0 flex-1 items-start gap-2">
              <span
                class="line-clamp-1 font-mono text-xs leading-relaxed break-all text-foreground"
              >
                {#if log.body}
                  {log.body}
                {:else}
                  <em class="text-muted-foreground">(empty body)</em>
                {/if}
              </span>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-background via-background/90 to-transparent transition-opacity duration-150"
      class:opacity-0={!showTopShadow}
      class:opacity-100={showTopShadow}
      aria-hidden="true"
    ></div>
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-gradient-to-t from-background via-background/90 to-transparent transition-opacity duration-150"
      class:opacity-0={!showBottomShadow}
      class:opacity-100={showBottomShadow}
      aria-hidden="true"
    ></div>
  </div>

  {#if selectedLog}
    <div
      transition:fly={{ x: 480, duration: 200 }}
      class="absolute inset-y-0 right-0 z-20 flex w-120 flex-col border-l shadow-xl"
    >
      <LogDetailPanel
        log={selectedLog}
        timezone={tz}
        onClose={() => (selectedLog = null)}
      />
    </div>
  {/if}
</div>
