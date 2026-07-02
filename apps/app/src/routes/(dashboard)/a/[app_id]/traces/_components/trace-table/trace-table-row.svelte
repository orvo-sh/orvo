<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { type TimeFilter, resolveTimeFilter } from "$lib/core/time-filter";
  import { cn } from "@repo/components";
  import { formatDurationNs } from "@repo/utils";

  import TimeCell from "../../../_components/time-cell.svelte";
  import type { Span } from "../../types";

  let { trace, timeFilter }: { trace: Span; timeFilter: TimeFilter } = $props();

  let { start, end } = resolveTimeFilter(timeFilter);
</script>

<div
  class={cn(
    "group flex min-h-11 cursor-pointer items-center pr-3 pl-0 transition-colors",
    trace.error_count > 0
      ? "bg-destructive/8 text-destructive hover:bg-destructive/18"
      : "hover:bg-muted",
  )}
  onclick={() =>
    goto(`/a/${page.params.app_id}/traces/${trace.id}${page.url.search}`)}
  onkeydown={(event) =>
    (event.key === "Enter" || event.key === " ") &&
    goto(`/a/${page.params.app_id}/traces/${trace.id}${page.url.search}`)}
  role="row"
  tabindex="0"
>
  <div class="mr-2 flex h-full min-h-11 w-3 shrink-0 self-stretch pt-1.5">
    <div
      class="ml-1 h-8 w-1 self-stretch rounded-none"
      class:bg-destructive={trace.error_count > 0}
      class:bg-accent={!trace.error_count}
    ></div>
  </div>

  <div
    class={cn(
      "flex w-36 shrink-0 items-center py-1.5 pr-0 font-mono text-xs tabular-nums",
      trace.error_count > 0 ? "text-destructive/80" : "text-muted-foreground",
    )}
  >
    <TimeCell
      date={new Date(trace.start_time)}
      rangeMs={Math.max(Math.abs(end.getTime() - start.getTime()), 1)}
    />
  </div>

  <div class="mr-3 flex min-w-0 flex-1 flex-col justify-center py-1.5">
    <span
      class={cn(
        "block truncate font-mono text-xs leading-relaxed break-all",
        trace.error_count ? "text-destructive" : "text-secondary-foreground",
      )}
    >
      {trace.display_name || trace.name || "Unnamed trace"}
    </span>
  </div>

  <div class="mr-3 hidden w-40 shrink-0 py-1.5 lg:flex lg:items-center">
    <div class="flex min-w-0 items-center gap-1">
      <span
        class="block truncate font-mono text-xs text-secondary-foreground"
        title={trace.service_names.join(", ")}
      >
        {trace.service_names[0] ?? "—"}
        {#if trace.service_names.length > 1}
          <span class="text-muted-foreground">
            (+{trace.service_names.length - 1})</span
          >
        {/if}
      </span>
    </div>
  </div>

  <div class="mr-3 flex w-20 shrink-0 items-center py-1.5">
    <span class="block font-mono text-xs text-muted-foreground tabular-nums">
      {formatDurationNs(trace.duration_ns)}
    </span>
  </div>

  <div class="flex w-16 shrink-0 items-center py-1.5">
    <span class="block text-xs text-muted-foreground tabular-nums">
      {trace.span_count}
    </span>
  </div>
</div>
