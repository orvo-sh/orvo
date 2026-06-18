<script lang="ts">
  import type { SpanRow } from "../../types";
  import { formatDuration } from "../../utils";

  type WaterfallItem = {
    span: SpanRow;
    depth: number;
    left: number;
    width: number;
  };

  let {
    spans = [],
    selectedSpanId = $bindable<string | null>(null),
  }: {
    spans?: SpanRow[];
    selectedSpanId?: string | null;
  } = $props();

  const waterfall = $derived.by((): WaterfallItem[] => {
    if (spans.length === 0) return [];

    const traceStart = Math.min(
      ...spans.map((s) => new Date(s.start_time).getTime()),
    );
    const traceEnd = Math.max(
      ...spans.map((s) => new Date(s.end_time).getTime()),
    );
    const total = Math.max(traceEnd - traceStart, 1);

    const spanMap = new Map(spans.map((s) => [s.span_id, s]));
    const depthCache = new Map<string, number>();

    const depth = (span: SpanRow): number => {
      if (depthCache.has(span.span_id)) return depthCache.get(span.span_id)!;
      const parent = span.parent_span_id
        ? spanMap.get(span.parent_span_id)
        : null;
      const d = parent ? depth(parent) + 1 : 0;
      depthCache.set(span.span_id, d);
      return d;
    };

    return spans.map((span) => {
      const start = new Date(span.start_time).getTime();
      const end = new Date(span.end_time).getTime();
      return {
        span,
        depth: depth(span),
        left: Math.max(((start - traceStart) / total) * 100, 0),
        width: Math.max(((end - start) / total) * 100, 0.4),
      };
    });
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
      label: i === 0 ? "0" : formatDuration(totalMs * (i / 4) * 1_000_000),
    }));
  });

  const LEFT_W = 280;
  const RIGHT_W = 56;
</script>

<div
  class="flex min-h-0 flex-1 flex-col overflow-hidden font-mono text-xs select-none"
>
  <!-- Ruler header -->
  <div class="flex shrink-0 border-b bg-muted/30">
    <!-- Name column header -->
    <div
      class="shrink-0 border-r px-3 py-1.5 font-sans text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
      style="width:{LEFT_W}px"
    >
      Span name
    </div>
    <!-- Timeline ruler -->
    <div class="relative flex-1 px-2 py-1.5">
      {#each ruler as { x, label }}
        <span
          class="absolute top-1.5 text-[10px] text-muted-foreground"
          style="left:{x}%; transform: translateX({x === 0
            ? '0'
            : x === 100
              ? '-100%'
              : '-50%'})"
        >
          {label}
        </span>
      {/each}
    </div>
    <!-- Duration column header -->
    <div
      class="shrink-0 border-l px-2 py-1.5 text-right font-sans text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
      style="width:{RIGHT_W}px"
    >
      Duration
    </div>
  </div>

  <!-- Span rows -->
  <div class="flex-1 overflow-y-auto">
    {#each waterfall as item (item.span.span_id)}
      {@const isError = item.span.status_code === 2}
      {@const isSelected = selectedSpanId === item.span.span_id}
      <button
        class="flex w-full items-center border-b border-b-border/30 text-left transition-colors
					{isSelected ? 'bg-muted' : 'hover:bg-muted/40'}
					{isError
          ? 'border-l-2 border-l-destructive'
          : 'border-l-2 border-l-transparent'}"
        onclick={() => (selectedSpanId = isSelected ? null : item.span.span_id)}
      >
        <!-- Name column -->
        <div
          class="flex h-10 min-w-0 shrink-0 flex-col justify-center border-r px-2 py-1.5"
          style="width:{LEFT_W}px; padding-left:{8 + item.depth * 14}px"
        >
          <span
            class="truncate text-[11px] font-medium {isError
              ? 'text-destructive'
              : 'text-foreground'}"
            title={item.span.name}
          >
            {item.span.name}
          </span>
          {#if item.span.service_name}
            <span class="truncate text-[10px] text-muted-foreground/70">
              {item.span.service_name}
            </span>
          {/if}
        </div>

        <!-- Timeline bar -->
        <div class="relative h-10 flex-1 px-2">
          <!-- Vertical grid lines at ruler marks -->
          {#each ruler as { x }}
            {#if x > 0 && x < 100}
              <div
                class="absolute top-0 bottom-0 w-px bg-border/30"
                style="left:{x}%"
              ></div>
            {/if}
          {/each}
          <!-- The span bar -->
          <div
            class="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm transition-opacity
							{isError ? 'bg-destructive/80' : 'bg-primary/70'}
							{isSelected
              ? 'opacity-100 ring-2 ring-primary/30'
              : 'opacity-80 hover:opacity-100'}"
            style="left:{item.left}%; width:max({item.width}%, 2px)"
          ></div>
        </div>

        <!-- Duration -->
        <div
          class="shrink-0 border-l px-2 text-right text-[10px] text-muted-foreground tabular-nums"
          style="width:{RIGHT_W}px"
        >
          {formatDuration(item.span.duration_ns)}
        </div>
      </button>
    {/each}
  </div>
</div>
