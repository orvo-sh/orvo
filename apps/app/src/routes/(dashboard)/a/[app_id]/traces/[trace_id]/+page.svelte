<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { IconBinaryTree2 as TreeStructureIcon } from "@tabler/icons-svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import type { Span } from "../types";
  import SpanDetailPanel from "./_components/span-detail-panel.svelte";
  import SpanWaterfall from "./_components/span-waterfall.svelte";

  let { data }: { data: { spans: Span[] } } = $props();

  let asideOpen = $state(Boolean(page.url.searchParams.get("span")));
  const spans = $derived(data.spans);
  const selectedSpanId = $derived(page.url.searchParams.get("span"));

  const serializeSearch = (entries: [string, string][]) =>
    entries.length === 0
      ? ""
      : `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`;

  const getSearchEntriesWithoutSpan = () =>
    [...page.url.searchParams.entries()].filter(([key]) => key !== "span");

  const getTraceHref = (spanId: string | null) => {
    const entries = getSearchEntriesWithoutSpan();
    if (spanId) {
      entries.push(["span", spanId]);
    }

    return `${page.url.pathname}${serializeSearch(entries)}`;
  };

  const backHref = $derived.by(() => {
    const search = serializeSearch(getSearchEntriesWithoutSpan());
    return `/a/${page.params.app_id}/traces${search}`;
  });

  const traceMeta = $derived.by(() => {
    if (spans.length === 0) return null;
    const root = spans.find((s) => !s.parent_span_id) ?? spans[0];
    return {
      name: root.name,
    };
  });

  const selectedSpan = $derived(
    selectedSpanId
      ? (spans.find((s) => s.span_id === selectedSpanId) ?? null)
      : null,
  );

  const updateSelectedSpan = (spanId: string | null) => {
    asideOpen = Boolean(spanId);
    void goto(resolve(getTraceHref(spanId)), {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
      invalidateAll: false,
    });
  };

  const closeSelectedSpan = () => {
    updateSelectedSpan(null);
  };

  const syncStateFromLocation = () => {
    asideOpen = Boolean(
      page.url.searchParams.get("span") &&
      spans.some((span) => span.span_id === page.url.searchParams.get("span")),
    );
  };
</script>

<svelte:window onpopstate={syncStateFromLocation} />

<PageContainer
  title={traceMeta?.name ?? "Trace"}
  chat={{
    kind: "trace",
    resourceId: page.params.trace_id,
    label: traceMeta?.name ?? page.params.trace_id,
    metadata: { traceId: page.params.trace_id },
  }}
  back={{ href: backHref, title: "Traces" }}
  asideTitle={selectedSpan?.name ?? "Span details"}
  bind:asideOpen
  class="min-h-0 overflow-hidden"
  contentClass="p-0!"
>
  {#snippet aside()}
    {#if selectedSpan}
      <SpanDetailPanel span={selectedSpan} onClose={closeSelectedSpan} />
    {/if}
  {/snippet}

  <div class="flex min-h-0 flex-1 overflow-hidden">
    {#if spans.length === 0}
      <div
        class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <TreeStructureIcon class="size-8 opacity-30" />
        <p class="text-sm">No spans found for this trace.</p>
      </div>
    {:else}
      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SpanWaterfall
          {spans}
          {selectedSpanId}
          onSelectSpan={updateSelectedSpan}
        />
      </div>
    {/if}
  </div>
</PageContainer>
