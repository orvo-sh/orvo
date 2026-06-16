<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Badge } from "@repo/components/ui/badge";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import TimeCell from "../../_components/time-cell.svelte";
  import type { ActiveFilter, TraceRow } from "../types";

  export function formatDuration(ns: number | string): string {
    const n = Number(ns);
    if (!Number.isFinite(n)) return "—";
    const ms = n / 1_000_000;
    if (ms < 1) return `${Math.round(n / 1_000)}µs`;
    if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : 1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function durationNsToFilterValue(ns: number): string {
    const ms = ns / 1_000_000;
    if (ms < 1000) {
      return `${Math.floor(ms)}ms`;
    }
    const s = ms / 1000;
    return `${Math.floor(s)}s`;
  }

  let {
    trace,
    index,
    onAddFilter,
    rangeStart,
    rangeEnd,
  }: {
    trace: TraceRow;
    index: number;
    onAddFilter: (filter: ActiveFilter) => void;
    rangeStart: Date;
    rangeEnd: Date;
  } = $props();

  const hasErrors = $derived(Number(trace.error_count) > 0);
  const traceHref = $derived(
    `/a/${page.params.app_id}/traces/${trace.trace_id}`,
  );
  const firstService = $derived(trace.service_names[0] ?? "—");
  const firstEnv = $derived(trace.deployment_environments[0] ?? "");
  const extraServices = $derived(
    trace.service_names.length > 1 ? trace.service_names.slice(1) : [],
  );
  const rangeMs = $derived(
    Math.max(Math.abs(rangeEnd.getTime() - rangeStart.getTime()), 1),
  );

  const addFilter = (e: MouseEvent, filter: ActiveFilter) => {
    e.stopPropagation();
    onAddFilter(filter);
  };
</script>

<div
  class={cn(
    "group flex min-h-10 cursor-pointer items-center gap-0 rounded-md px-3 py-2 pl-2 transition-colors hover:brightness-95",
    index % 2 === 0 ? "bg-background" : "bg-muted/65",
  )}
  onclick={() => goto(traceHref)}
  onkeydown={(e) => (e.key === "Enter" || e.key === " ") && goto(traceHref)}
  role="row"
  tabindex="0"
>
  <div
    class={cn(
      "mr-4 w-1 self-stretch rounded-xs",
      Number(trace.error_count) > 0 ? "bg-destructive" : "bg-accent",
    )}
  ></div>

  <!-- Time -->
  <div
    class="mr-1.5 flex w-36 shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
  >
    <TimeCell date={new Date(trace.start_time)} {rangeMs} />
  </div>

  <!-- Name + env -->
  <div class="mr-3 min-w-0 flex-1">
    <button
      type="button"
      class="block truncate text-left text-xs font-medium text-foreground hover:underline hover:underline-offset-2"
      onclick={(e) =>
        addFilter(e, {
          attribute: "trace.name",
          operator: "eq",
          value: trace.name || "Unnamed trace",
        })}
    >
      {trace.name || "Unnamed trace"}
    </button>
    {#if firstEnv}
      <button
        type="button"
        class="block truncate text-left text-[10px] text-muted-foreground/60 hover:underline hover:underline-offset-2"
        onclick={(e) =>
          addFilter(e, {
            attribute: "deployment.environment",
            operator: "eq",
            value: firstEnv,
          })}
      >
        {firstEnv}
      </button>
    {/if}
  </div>

  <!-- Service -->
  <div class="mr-3 w-32 shrink-0">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="block truncate text-left text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline hover:underline-offset-2"
        onclick={(e) =>
          addFilter(e, {
            attribute: "service.name",
            operator: "eq",
            value: firstService,
          })}
        title={trace.service_names.join(", ")}
      >
        {firstService}
      </button>
      {#if extraServices.length > 0}
        <HoverCard.Root openDelay={50} closeDelay={50}>
          <HoverCard.Trigger>
            <Badge
              variant="outline"
              class="h-4 cursor-pointer px-1 text-[10px]"
            >
              +{extraServices.length}
            </Badge>
          </HoverCard.Trigger>
          <HoverCard.Content class="w-auto max-w-xs min-w-0 text-xs">
            <div class="space-y-1">
              {#each extraServices as service}
                <div class="text-muted-foreground">{service}</div>
              {/each}
            </div>
          </HoverCard.Content>
        </HoverCard.Root>
      {/if}
    </div>
  </div>

  <!-- Duration -->
  <div class="mr-3 w-20 shrink-0">
    <button
      type="button"
      class="block font-mono text-xs text-muted-foreground tabular-nums transition-colors hover:text-foreground hover:underline hover:underline-offset-2"
      onclick={(e) =>
        addFilter(e, {
          attribute: "trace.duration",
          operator: "gt",
          value: durationNsToFilterValue(Number(trace.duration_ns)),
        })}
    >
      {formatDuration(trace.duration_ns)}
    </button>
  </div>

  <!-- Span count -->
  <div class="w-16 shrink-0">
    <span class="block text-xs text-muted-foreground tabular-nums">
      {trace.span_count}
    </span>
  </div>
</div>
