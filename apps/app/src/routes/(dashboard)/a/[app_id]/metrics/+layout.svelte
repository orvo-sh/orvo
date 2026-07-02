<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { navigating, page } from "$app/state";
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { IconFileDescription, IconSearch } from "@tabler/icons-svelte";
  import LiveRefreshButtonGroup from "../_components/live-refresh-button-group.svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import TimeRangePicker from "../_components/time-range-picker.svelte";
  import type { LogTimeFilter } from "../logs/types";
  import type { LayoutData } from "./$types";
  import {
    createMetricsStateSearchParams,
    decodeMetricName,
    encodeMetricName,
  } from "./state";

  let {
    children,
    data,
  }: {
    children: import("svelte").Snippet;
    data: LayoutData;
  } = $props();

  let time = $state<LogTimeFilter>(data.time);
  let live = $state(data.live);
  let search = $state(data.search);
  let searchDraft = $state(data.search);

  const metricsBasePath = $derived(`/a/${page.params.app_id}/metrics`);
  const loading = $derived(
    navigating.to?.url.pathname.startsWith(metricsBasePath) ?? false,
  );
  const nextSearch = $derived.by(() => {
    const searchParams = createMetricsStateSearchParams({
      time,
      search,
      live,
      aggregation: data.aggregation,
    });

    return searchParams.toString();
  });

  const refresh = async () => {
    if (time.kind === "range") {
      time = {
        kind: "range",
        startAtUtc: time.startAtUtc,
        endAtUtc: new Date().toISOString(),
      };
      return;
    }

    await invalidateAll();
  };

  $effect(() => {
    time = data.time;
    live = data.live;
    search = data.search;
    searchDraft = data.search;
  });

  $effect(() => {
    const timeout = setTimeout(() => {
      search = searchDraft.trim();
    }, 250);

    return () => clearTimeout(timeout);
  });

  $effect(() => {
    if (!live) {
      return;
    }

    if (time.kind === "range") {
      time = {
        kind: "range",
        startAtUtc: time.startAtUtc,
        endAtUtc: new Date().toISOString(),
      };
    }

    const id = setInterval(() => {
      if (time.kind === "range") {
        time = {
          kind: "range",
          startAtUtc: time.startAtUtc,
          endAtUtc: new Date().toISOString(),
        };
        return;
      }

      void invalidateAll();
    }, 2000);

    return () => clearInterval(id);
  });

  $effect(() => {
    if (nextSearch === page.url.searchParams.toString()) {
      return;
    }

    const href = nextSearch
      ? `${page.url.pathname}?${nextSearch}`
      : page.url.pathname;
    void goto(href, {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    });
  });
</script>

<PageContainer
  title="Metrics"
  class="overflow-hidden bg-background"
  contentClass="p-0!"
  scrollContent={false}
>
  {#snippet helper()}
    <div class="space-y-2">
      <p>
        Metrics show how your systems behave over time, from infrastructure
        health to application throughput and latency.
      </p>
      <p>
        Use this page to inspect one metric at a time, choose the right view for
        its type, and watch how it changes across your services.
      </p>
      <Button
        href="https://orvo.sh/docs/metrics"
        size="sm"
        target="_blank"
        variant="outline"
        class="mt-2 w-full"
      >
        <IconFileDescription data-slot="button-icon" />
        Metrics docs
      </Button>
    </div>
  {/snippet}

  {#snippet actions()}
    <div class="flex items-center gap-2">
      <TimeRangePicker bind:time />
      <LiveRefreshButtonGroup bind:live {refresh} />
    </div>
  {/snippet}

  <div
    class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]"
  >
    <aside class="relative min-h-0 border-r bg-background">
      <div
        class="pointer-events-none absolute inset-0 z-20 bg-secondary opacity-0 transition-opacity"
        class:opacity-50={loading}
      ></div>

      <div class="border-b px-3 py-2">
        <div class="relative">
          <IconSearch
            class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            bind:value={searchDraft}
            placeholder="Search metrics"
            class="bg-background pl-9"
          />
        </div>
      </div>

      <div class="min-h-0 overflow-auto">
        {#if data.error}
          <div class="px-3 py-8 text-sm text-destructive">{data.error}</div>
        {:else if data.catalog.length === 0}
          <div class="px-3 py-8 text-sm text-muted-foreground">
            {search
              ? "No metrics match this search yet."
              : "No metrics were found for this time range yet."}
          </div>
        {:else}
          {#each data.catalog as metric}
            <a
              href={`${metricsBasePath}/${encodeMetricName(metric.name)}${nextSearch ? `?${nextSearch}` : ""}`}
              aria-current={page.params.metric_name &&
              decodeMetricName(page.params.metric_name) === metric.name
                ? "page"
                : undefined}
              class={cn(
                "flex items-center justify-between gap-3 border-b px-3 py-2 text-sm transition-colors hover:bg-muted/40",
                page.params.metric_name &&
                  decodeMetricName(page.params.metric_name) === metric.name &&
                  "bg-muted/40",
              )}
            >
              <span class="min-w-0 truncate text-sm">{metric.name}</span>
              <span class="shrink-0 text-xs text-muted-foreground">
                {metric.type || "unknown"}
              </span>
            </a>
          {/each}
        {/if}
      </div>
    </aside>

    <div class="min-h-0 overflow-hidden bg-background">
      {@render children()}
    </div>
  </div>
</PageContainer>
