<script lang="ts">
  import { cn } from "@repo/components";
  import { Label } from "@repo/components/ui/label";
  import { formatDurationNs } from "@repo/utils";
  import {
    IconChevronDown as ChevronDownIcon,
    IconChevronRight as ChevronRightIcon,
  } from "@tabler/icons-svelte";
  import type { SpanRow } from "../../types";

  type WaterfallItem = {
    span: SpanRow;
    depth: number;
    left: number;
    width: number;
    hasChildren: boolean;
  };

  let {
    spans = [],
    selectedSpanId = null,
    onSelectSpan,
  }: {
    spans?: SpanRow[];
    selectedSpanId?: string | null;
    onSelectSpan: (spanId: string | null) => void;
  } = $props();

  let collapsedSpanIds = $state<string[]>([]);

  const waterfall = $derived.by((): WaterfallItem[] => {
    if (spans.length === 0) return [];

    const sortedSpans = [...spans].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
    const traceStart = Math.min(
      ...spans.map((s) => new Date(s.start_time).getTime()),
    );
    const traceEnd = Math.max(
      ...spans.map((s) => new Date(s.end_time).getTime()),
    );
    const total = Math.max(traceEnd - traceStart, 1);

    const spanIds = Object.fromEntries(
      spans.map((span) => [span.span_id, true]),
    );
    const childrenByParent: Record<string, SpanRow[]> = {};
    const rootSpans: SpanRow[] = [];

    for (const span of sortedSpans) {
      if (span.parent_span_id && spanIds[span.parent_span_id]) {
        const siblings = childrenByParent[span.parent_span_id] ?? [];
        siblings.push(span);
        childrenByParent[span.parent_span_id] = siblings;
        continue;
      }

      rootSpans.push(span);
    }

    const items: WaterfallItem[] = [];
    const walk = (span: SpanRow, depth: number) => {
      const children = childrenByParent[span.span_id] ?? [];
      const start = new Date(span.start_time).getTime();
      const end = new Date(span.end_time).getTime();
      items.push({
        span,
        depth,
        left: Math.max(((start - traceStart) / total) * 100, 0),
        width: Math.max(((end - start) / total) * 100, 0.4),
        hasChildren: children.length > 0,
      });

      if (collapsedSpanIds.includes(span.span_id)) {
        return;
      }

      for (const child of children) {
        walk(child, depth + 1);
      }
    };

    for (const span of rootSpans) {
      walk(span, 0);
    }

    return items;
  });

  // 5-point ruler labels across the total trace duration
  const ruler = $derived.by(() => {
    if (spans.length === 0) return [];
    const traceStart = Math.min(
      ...spans.map((s) => new Date(s.start_time).getTime()),
    );
    const traceEnd = Math.max(
      ...spans.map((s) => new Date(s.end_time).getTime()),
    );
    const totalMs = traceEnd - traceStart;
    return Array.from({ length: 5 }, (_, i) => ({
      x: (i / 4) * 100,
      label: i === 0 ? "0" : formatDurationNs(totalMs * (i / 4) * 1_000_000),
    }));
  });

  const LEFT_W = 320;
  const WATERFALL_LANE_INSET = 12;

  const toggleCollapsed = (spanId: string) => {
    collapsedSpanIds = collapsedSpanIds.includes(spanId)
      ? collapsedSpanIds.filter((value) => value !== spanId)
      : [...collapsedSpanIds, spanId];
  };
</script>

<div class="h-full min-h-0 w-full overflow-x-auto">
  <div
    class="flex h-full min-h-0 min-w-[56rem] flex-1 flex-col font-mono text-xs select-none"
  >
    <div
      class="flex shrink-0 items-center gap-0 border-b px-2 py-1.5 tracking-wide text-muted-foreground uppercase"
      role="row"
    >
      <Label
        class="shrink-0 px-1 text-xs font-normal"
        style={`width:${LEFT_W}px`}
      >
        Span
      </Label>
      <div class="min-w-0 flex-1 pr-2">
        <div
          class="relative h-full min-w-0"
          style={`margin-left:${WATERFALL_LANE_INSET}px`}
        >
          {#each ruler as { x, label } (x)}
            <Label
              class="absolute top-1/2 text-xs font-normal "
              style="left:{x}%; transform: translateX({x === 0
                ? '0'
                : x === 100
                  ? '-100%'
                  : '-50%'}) translateY(-50%)"
            >
              {label}
            </Label>
          {/each}
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {#each waterfall as item (item.span.span_id)}
        {@const isError = item.span.status_code === 2}
        {@const isSelected = selectedSpanId === item.span.span_id}
        <div
          data-selected={isSelected}
          class={cn(
            "group flex w-full cursor-pointer items-center gap-0 py-0.5 pr-2 pl-2 text-left transition-colors",
            isError
              ? "bg-destructive/8 text-destructive hover:bg-destructive/18 data-[selected=true]:bg-destructive/18"
              : "text-primary hover:bg-muted data-[selected=true]:bg-muted",
          )}
          onclick={() => onSelectSpan(isSelected ? null : item.span.span_id)}
          onkeydown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectSpan(isSelected ? null : item.span.span_id);
            }
          }}
          role="button"
          tabindex="0"
        >
          <div
            class="flex h-8 min-w-0 shrink-0 items-center border-r pr-2"
            style="width:{LEFT_W}px; padding-left:{8 + item.depth * 12}px"
          >
            {#if item.hasChildren}
              <button
                type="button"
                class="mr-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                onclick={(event) => {
                  event.stopPropagation();
                  toggleCollapsed(item.span.span_id);
                }}
                aria-label={collapsedSpanIds.includes(item.span.span_id)
                  ? "Expand span"
                  : "Collapse span"}
              >
                {#if collapsedSpanIds.includes(item.span.span_id)}
                  <ChevronRightIcon class="size-3.5" />
                {:else}
                  <ChevronDownIcon class="size-3.5" />
                {/if}
              </button>
            {:else}
              <span class="mr-0.5 block size-4 shrink-0"></span>
            {/if}

            <span
              class={cn(
                "block min-w-0 truncate text-xs leading-none text-secondary-foreground",
                isError && "text-destructive",
              )}
              title={item.span.name}
            >
              {item.span.name}
            </span>
          </div>

          <div class="min-w-0 flex-1 pr-2">
            <div
              class="relative h-8 min-w-0"
              style={`margin-left:${WATERFALL_LANE_INSET}px`}
            >
              {#each ruler as { x } (x)}
                {#if x > 0 && x < 100}
                  <div
                    class="absolute top-0 bottom-0 w-px bg-border/30"
                    style="left:{x}%"
                  ></div>
                {/if}
              {/each}

              <div
                class={cn(
                  "absolute top-1/2 h-4 -translate-y-1/2 rounded-sm transition-all",
                  isError
                    ? "bg-linear-to-t from-destructive to-destructive/65"
                    : "bg-linear-to-t from-primary to-primary/65",
                  isSelected
                    ? "opacity-100 ring-2 ring-primary/20"
                    : "opacity-90 group-hover:opacity-100",
                )}
                style="left:{item.left}%; width:max({item.width}%, 2px)"
              ></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
