<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { getTraceQuery } from "$lib/api/traces.remote";
  import {
    IconAlertCircle as WarningCircleIcon,
    IconBinaryTree2 as TreeStructureIcon,
    IconCheck as CheckIcon,
    IconCopy as CopyIcon,
  } from "@tabler/icons-svelte";
  import { Button } from "@repo/components/ui/button";
  import { Badge } from "@repo/components/ui/badge";
  import { formatDuration } from "../utils";
  import SpanWaterfall from "./_components/span-waterfall.svelte";
  import SpanDetailPanel from "./_components/span-detail-panel.svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import type { SpanRow } from "../types";

  const traceId = $derived(page.params.trace_id ?? "");
  let spans = $state<SpanRow[]>([]);
  let loading = $state(false);
  let error = $state("");
  let loadRequest = 0;

  const loadTrace = async (id: string) => {
    if (!id) return;

    const requestId = ++loadRequest;
    loading = true;
    error = "";
    selectedSpanId = null;

    const result = await getTraceQuery({ traceId: id }).run();

    if (requestId !== loadRequest) {
      return;
    }

    if (result.success === false) {
      error = result.error;
      loading = false;
      return;
    }

    spans = result.data.spans;
    loading = false;
  };

  const traceMeta = $derived.by(() => {
    if (spans.length === 0) return null;
    const start = Math.min(
      ...spans.map((s) => new Date(s.start_time).getTime()),
    );
    const end = Math.max(...spans.map((s) => new Date(s.end_time).getTime()));
    const root = spans.find((s) => !s.parent_span_id) ?? spans[0];
    const services = [
      ...new Set(spans.map((s) => s.service_name).filter(Boolean)),
    ];
    const errorCount = spans.filter((s) => s.status_code === 2).length;
    return {
      name: root.name,
      durationNs: (end - start) * 1_000_000,
      startTime: new Date(start).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
      services,
      spanCount: spans.length,
      errorCount,
      environment: root.deployment_environment,
    };
  });

  let selectedSpanId = $state<string | null>(null);
  const selectedSpan = $derived(
    selectedSpanId
      ? (spans.find((s) => s.span_id === selectedSpanId) ?? null)
      : null,
  );

  let copied = $state(false);
  const copyTraceId = async () => {
    await navigator.clipboard.writeText(traceId);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  };

  $effect(() => {
    const id = traceId;
    if (!id) return;

    const timeout = setTimeout(() => {
      void loadTrace(id);
    }, 0);

    return () => clearTimeout(timeout);
  });
</script>

<PageContainer
  title={traceMeta?.name ?? "Trace"}
  back={resolve(`/a/${page.params.app_id}/traces`)}
  class="min-h-0 overflow-hidden"
  innerClass="p-0!"
  scrollContent={false}
>
  {#snippet actions()}
    <Button variant="outline" size="sm" onclick={copyTraceId}>
      {#if copied}
        <CheckIcon data-slot="button-icon" />
        Copied
      {:else}
        <CopyIcon data-slot="button-icon" />
        Copy ID
      {/if}
    </Button>
  {/snippet}

  <!-- Meta section -->
  {#if traceMeta}
    <div
      class="flex shrink-0 items-center gap-4 border-b bg-background px-4 py-2"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <p class="truncate font-mono text-[11px] text-muted-foreground/60">
          {traceId}
        </p>
        {#if traceMeta.errorCount > 0}
          <Badge variant="destructive" class="text-[10px]">
            <WarningCircleIcon class="size-3" />
            {traceMeta.errorCount} error{traceMeta.errorCount !== 1 ? "s" : ""}
          </Badge>
        {/if}
      </div>
      <div class="flex shrink-0 items-center gap-4 text-xs">
        <div class="text-center">
          <div
            class="text-[10px] tracking-wide text-muted-foreground uppercase"
          >
            Duration
          </div>
          <div class="font-mono font-medium text-foreground">
            {formatDuration(traceMeta.durationNs)}
          </div>
        </div>
        <div class="text-center">
          <div
            class="text-[10px] tracking-wide text-muted-foreground uppercase"
          >
            Spans
          </div>
          <div class="font-medium text-foreground">{traceMeta.spanCount}</div>
        </div>
        <div class="text-center">
          <div
            class="text-[10px] tracking-wide text-muted-foreground uppercase"
          >
            Services
          </div>
          <div class="max-w-40 truncate font-medium text-foreground">
            {traceMeta.services.join(", ")}
          </div>
        </div>
        <div class="text-center">
          <div
            class="text-[10px] tracking-wide text-muted-foreground uppercase"
          >
            Start
          </div>
          <div class="text-foreground tabular-nums">{traceMeta.startTime}</div>
        </div>
        {#if traceMeta.environment}
          <div class="text-center">
            <div
              class="text-[10px] tracking-wide text-muted-foreground uppercase"
            >
              Env
            </div>
            <span
              class="inline-flex items-center rounded-sm border border-border/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground"
            >
              {traceMeta.environment}
            </span>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Body: waterfall + optional span detail panel -->
  <div class="flex min-h-0 flex-1 overflow-hidden">
    {#if loading}
      <div
        class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <TreeStructureIcon class="size-8 animate-pulse opacity-30" />
        <p class="text-sm">Loading trace spans…</p>
      </div>
    {:else if error}
      <div
        class="flex flex-1 flex-col items-center justify-center gap-3 text-destructive"
      >
        <WarningCircleIcon class="size-8 opacity-70" />
        <p class="text-sm">{error}</p>
      </div>
    {:else if spans.length === 0}
      <div
        class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <TreeStructureIcon class="size-8 opacity-30" />
        <p class="text-sm">No spans found for this trace.</p>
      </div>
    {:else}
      <!-- Waterfall -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SpanWaterfall {spans} bind:selectedSpanId />
      </div>

      <!-- Span detail panel (slides in when a span is selected) -->
      {#if selectedSpan}
        <div class="flex min-h-0 w-80 shrink-0 flex-col overflow-hidden">
          <SpanDetailPanel
            span={selectedSpan}
            onClose={() => (selectedSpanId = null)}
          />
        </div>
      {/if}
    {/if}
  </div>
</PageContainer>
