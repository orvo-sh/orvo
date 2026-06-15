<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { markOrganizationActivationTelemetryViewedCommand } from "$lib/api/organization-activation.remote";
  import {
    completeOrganizationActivationStep,
    restoreOrganizationActivation,
  } from "$lib/stores/organization-activation.svelte";
  import { getMetricsExplorerQuery } from "$lib/api/metrics.remote";
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import * as ButtonGroup from "@repo/components/ui/button-group";
  import * as Card from "@repo/components/ui/card";
  import { formatNumber } from "@repo/utils";
  import {
    IconChartAreaLine,
    IconDatabase,
    IconListDetails,
    IconReload,
    IconServer,
  } from "@tabler/icons-svelte";
  import PageContainer from "../../../_components/page-container/page-container.svelte";
  import MetricsFilterBar from "./_components/metrics-filter-bar.svelte";
  import MetricsTimeseriesChart from "./_components/metrics-timeseries-chart.svelte";
  import type {
    LogTimeFilter,
    MetricAggregation,
    MetricCatalogItem,
    MetricFilters,
    MetricGroupBy,
    MetricsExplorerResult,
  } from "./types";

  type MetricTimePreset = Extract<LogTimeFilter, { kind: "preset" }>["preset"];
  type ViewMode = "graph" | "table";

  const defaultMetricsData = (): MetricsExplorerResult => ({
    summary: {
      totalPoints: 0,
      metricCount: 0,
      serviceCount: 0,
      environmentCount: 0,
      lastSeen: null,
    },
    facets: {
      metrics: [],
      services: [],
      environments: [],
    },
    catalog: [],
    series: [],
    samples: [],
    startAtUtc: new Date().toISOString(),
    endAtUtc: new Date().toISOString(),
  });

  const MIN_BUCKET_COUNT = 24;
  const MAX_BUCKET_COUNT = 120;
  const MINUTE_MS = 60_000;
  const HOUR_MS = 60 * MINUTE_MS;
  const DAY_MS = 24 * HOUR_MS;
  const AUTO_BUCKET_SIZES_MS = [
    { maxRangeMs: HOUR_MS, bucketSizeMs: MINUTE_MS },
    { maxRangeMs: 4 * HOUR_MS, bucketSizeMs: 2 * MINUTE_MS },
    { maxRangeMs: 12 * HOUR_MS, bucketSizeMs: 5 * MINUTE_MS },
    { maxRangeMs: DAY_MS, bucketSizeMs: 15 * MINUTE_MS },
    { maxRangeMs: 3 * DAY_MS, bucketSizeMs: 30 * MINUTE_MS },
    { maxRangeMs: 7 * DAY_MS, bucketSizeMs: 2 * HOUR_MS },
    { maxRangeMs: 30 * DAY_MS, bucketSizeMs: 12 * HOUR_MS },
  ] as const;

  let time = $state<LogTimeFilter>({
    kind: "preset",
    preset: "last_hour",
  });
  let filters = $state<MetricFilters>({
    search: "",
    metricName: "",
    services: [],
    environments: [],
  });
  let aggregation = $state<MetricAggregation>("avg");
  let groupBy = $state<MetricGroupBy>("service");
  let viewMode = $state<ViewMode>("graph");
  let metricsData = $state<MetricsExplorerResult>(defaultMetricsData());
  let loading = $state(false);
  let error = $state("");
  let loadRequest = 0;
  let telemetryActivationSent = $state(false);

  const resolvePresetRange = (preset: MetricTimePreset) => {
    const end = new Date();

    switch (preset) {
      case "last_hour":
        return { start: new Date(end.getTime() - HOUR_MS), end };
      case "today": {
        const start = new Date(end);
        start.setHours(0, 0, 0, 0);
        return { start, end };
      }
      case "last_24_hours":
        return { start: new Date(end.getTime() - DAY_MS), end };
      case "last_3_days":
        return { start: new Date(end.getTime() - 3 * DAY_MS), end };
      case "last_7_days":
        return { start: new Date(end.getTime() - 7 * DAY_MS), end };
      case "last_2_weeks":
        return { start: new Date(end.getTime() - 14 * DAY_MS), end };
      case "last_month":
        return { start: new Date(end.getTime() - 30 * DAY_MS), end };
    }
  };

  const resolvedRange = $derived.by(() => {
    if (time.kind === "range") {
      return {
        start: new Date(time.startAtUtc),
        end: new Date(time.endAtUtc),
      };
    }

    return resolvePresetRange(time.preset);
  });

  const bucketCount = $derived.by(() => {
    const rangeMs = Math.max(
      resolvedRange.end.getTime() - resolvedRange.start.getTime(),
      1,
    );
    const bucketSizeMs =
      AUTO_BUCKET_SIZES_MS.find(({ maxRangeMs }) => rangeMs <= maxRangeMs)
        ?.bucketSizeMs ?? Math.ceil(rangeMs / 72);

    return Math.min(
      MAX_BUCKET_COUNT,
      Math.max(MIN_BUCKET_COUNT, Math.ceil(rangeMs / bucketSizeMs)),
    );
  });

  const selectedMetric = $derived(
    metricsData.catalog.find((metric) => metric.name === filters.metricName) ??
      null,
  );
  const selectedMetricTitle = $derived(
    selectedMetric?.name ?? filters.metricName ?? "Select a metric",
  );
  const metricUnit = $derived(selectedMetric?.unit ?? "");
  const metricOptions = $derived(metricsData.facets.metrics);
  const serviceOptions = $derived(
    metricsData.facets.services.map((service) => ({
      value: service.value,
      label: service.value,
    })),
  );
  const environmentOptions = $derived(
    metricsData.facets.environments.map((environment) => ({
      value: environment.value,
      label: environment.value,
    })),
  );

  const querySignature = $derived.by(() =>
    JSON.stringify({
      time,
      search: filters.search,
      metricName: filters.metricName,
      services: filters.services,
      environments: filters.environments,
      aggregation,
      groupBy,
      bucketCount,
    }),
  );

  const createMetricsInput = () => ({
    time,
    search: filters.search.trim(),
    metricName: filters.metricName || undefined,
    services: filters.services,
    environments: filters.environments,
    aggregation,
    groupBy,
    bucketCount,
    sampleLimit: 50,
  });

  const refreshMetrics = async () => {
    const requestId = ++loadRequest;
    loading = true;
    error = "";

    const result = await getMetricsExplorerQuery(createMetricsInput()).run();

    if (requestId !== loadRequest) {
      return;
    }

    if (result.success === false) {
      error = result.error;
      loading = false;
      return;
    }

    metricsData = result.data;
    loading = false;
  };

  const refresh = () => {
    if (time.kind === "range") {
      time = {
        kind: "range",
        startAtUtc: time.startAtUtc,
        endAtUtc: new Date().toISOString(),
      };
      return;
    }

    time = { ...time };
  };

  const selectMetric = (metric: MetricCatalogItem) => {
    filters.metricName = metric.name;
    if (groupBy === "metric") {
      groupBy = "service";
    }
  };

  const formatMetricValue = (value: number | null, unit = "") => {
    if (value === null || !Number.isFinite(value)) {
      return "n/a";
    }

    const formatted =
      Math.abs(value) >= 1000
        ? formatNumber(value)
        : Number.isInteger(value)
          ? value.toString()
          : value.toFixed(Math.abs(value) < 10 ? 2 : 1);

    return unit ? `${formatted} ${unit}` : formatted;
  };

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return "No data";
    }

    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  $effect(() => {
    querySignature;

    const timeout = setTimeout(() => {
      void refreshMetrics();
    }, 250);

    return () => clearTimeout(timeout);
  });

  const markTelemetryViewed = async () => {
    if (telemetryActivationSent) {
      return;
    }

    telemetryActivationSent = true;
    const previousActivation =
      completeOrganizationActivationStep("hasViewedTelemetry");
    const result = await markOrganizationActivationTelemetryViewedCommand({});

    if (result.success === false) {
      telemetryActivationSent = false;
      restoreOrganizationActivation(
        page.data.activeOrganizationId,
        previousActivation,
      );
      return;
    }

    void invalidateAll();
  };

  $effect(() => {
    if (!page.data.organizationActivation) {
      return;
    }

    if (page.data.organizationActivation.hasViewedTelemetry) {
      return;
    }

    if (metricsData.summary.totalPoints === 0) {
      return;
    }

    void markTelemetryViewed();
  });

  $effect(() => {
    if (filters.metricName || metricsData.catalog.length === 0) {
      return;
    }

    filters.metricName = metricsData.catalog[0].name;
  });
</script>

<PageContainer
  title="Metrics"
  class="overflow-hidden bg-secondary"
  innerClass="p-0!"
  scrollContent={false}
>
  {#snippet actions()}
    <Button variant="outline" onclick={refresh} {loading}>
      <IconReload data-slot="button-icon" />
      Refresh
    </Button>
  {/snippet}

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <MetricsFilterBar
      bind:time
      bind:filters
      bind:aggregation
      bind:groupBy
      {metricOptions}
      {serviceOptions}
      {environmentOptions}
    />

    {#if error}
      <div
        class="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive"
      >
        {error}
      </div>
    {/if}

    <div
      class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]"
    >
      <aside class="min-h-0 border-r bg-background">
        <div class="flex items-center justify-between border-b px-3 py-2">
          <div>
            <p class="text-sm font-medium">Metric browser</p>
            <p class="text-xs text-muted-foreground">
              {formatNumber(metricsData.summary.metricCount)} names
            </p>
          </div>
          <IconListDetails class="size-4 text-muted-foreground" />
        </div>
        <div class="h-full min-h-0 overflow-auto p-2 pb-16">
          {#each metricsData.catalog as metric}
            <button
              type="button"
              class={cn(
                "flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted",
                filters.metricName === metric.name &&
                  "bg-muted text-foreground",
              )}
              onclick={() => selectMetric(metric)}
            >
              <span class="truncate text-sm font-medium">{metric.name}</span>
              <span
                class="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span>{metric.type || "unknown"}</span>
                <span class="h-1 w-1 rounded-full bg-border"></span>
                <span>{formatNumber(metric.points)} pts</span>
              </span>
            </button>
          {/each}

          {#if metricsData.catalog.length === 0}
            <div
              class="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center"
            >
              <p class="text-sm font-medium">No metrics found</p>
              <p class="mt-1 text-xs text-muted-foreground">
                Send metrics or loosen the current filters.
              </p>
            </div>
          {/if}
        </div>
      </aside>

      <main class="min-h-0 overflow-auto p-3">
        <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-lg font-semibold tracking-tight">
              {selectedMetricTitle}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {selectedMetric?.description ||
                "Graph one metric at a time, then split it by service or environment."}
            </p>
          </div>

          <ButtonGroup.Root>
            <Button
              variant={viewMode === "graph" ? "secondary" : "outline"}
              onclick={() => (viewMode = "graph")}
            >
              <IconChartAreaLine data-slot="button-icon" />
              Graph
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "outline"}
              onclick={() => (viewMode = "table")}
            >
              <IconListDetails data-slot="button-icon" />
              Table
            </Button>
          </ButtonGroup.Root>
        </div>

        {#if viewMode === "graph"}
          <MetricsTimeseriesChart
            title={selectedMetricTitle}
            description={`Split by ${groupBy === "none" ? "nothing" : groupBy}`}
            series={metricsData.series}
            {aggregation}
            unit={metricUnit}
            {loading}
          />
        {:else}
          <Card.Root class="overflow-hidden">
            <Card.Header class="pb-3">
              <Card.Title class="text-sm font-medium">Recent samples</Card.Title
              >
              <Card.Description
                >Latest raw points for the selected metric</Card.Description
              >
            </Card.Header>
            <Card.Content class="p-0">
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead
                    class="border-y bg-muted/50 text-xs text-muted-foreground"
                  >
                    <tr>
                      <th class="px-4 py-2 text-left font-medium">Time</th>
                      <th class="px-3 py-2 text-left font-medium">Service</th>
                      <th class="px-3 py-2 text-left font-medium"
                        >Environment</th
                      >
                      <th class="px-4 py-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each metricsData.samples as sample}
                      <tr class="border-b last:border-b-0">
                        <td
                          class="px-4 py-2 whitespace-nowrap text-muted-foreground"
                        >
                          {formatDateTime(sample.time)}
                        </td>
                        <td class="px-3 py-2"
                          >{sample.serviceName || "unknown service"}</td
                        >
                        <td class="px-3 py-2"
                          >{sample.environment || "unknown environment"}</td
                        >
                        <td
                          class="px-4 py-2 text-right font-medium tabular-nums"
                        >
                          {formatMetricValue(sample.value, sample.unit)}
                        </td>
                      </tr>
                    {/each}
                    {#if metricsData.samples.length === 0}
                      <tr>
                        <td
                          colspan="4"
                          class="px-4 py-12 text-center text-muted-foreground"
                        >
                          No samples match this metric.
                        </td>
                      </tr>
                    {/if}
                  </tbody>
                </table>
              </div>
            </Card.Content>
          </Card.Root>
        {/if}
      </main>

      <aside
        class="hidden min-h-0 overflow-auto border-l bg-background p-3 xl:block"
      >
        <div class="space-y-3">
          <Card.Root>
            <Card.Header class="pb-3">
              <Card.Title class="text-sm font-medium">Latest value</Card.Title>
              <Card.Description
                >{formatDateTime(
                  selectedMetric?.lastSeen ?? null,
                )}</Card.Description
              >
            </Card.Header>
            <Card.Content>
              <p class="text-2xl font-semibold tracking-tight">
                {formatMetricValue(
                  selectedMetric?.lastValue ?? null,
                  selectedMetric?.unit ?? "",
                )}
              </p>
              <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p class="text-xs text-muted-foreground">Type</p>
                  <p class="mt-1 truncate font-medium">
                    {selectedMetric?.type || "unknown"}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Unit</p>
                  <p class="mt-1 truncate font-medium">
                    {selectedMetric?.unit || "none"}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Points</p>
                  <p class="mt-1 font-medium">
                    {formatNumber(selectedMetric?.points ?? 0)}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Services</p>
                  <p class="mt-1 font-medium">
                    {formatNumber(selectedMetric?.services ?? 0)}
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card.Root>

          <Card.Root>
            <Card.Header class="pb-3">
              <Card.Title class="text-sm font-medium">In this range</Card.Title>
            </Card.Header>
            <Card.Content class="grid gap-3 text-sm">
              <div class="flex items-center justify-between">
                <span
                  class="inline-flex items-center gap-2 text-muted-foreground"
                >
                  <IconDatabase class="size-4" />
                  Points
                </span>
                <span class="font-medium tabular-nums">
                  {formatNumber(metricsData.summary.totalPoints)}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span
                  class="inline-flex items-center gap-2 text-muted-foreground"
                >
                  <IconServer class="size-4" />
                  Services
                </span>
                <span class="font-medium tabular-nums">
                  {formatNumber(metricsData.summary.serviceCount)}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Last point</span>
                <span class="text-right font-medium"
                  >{formatDateTime(metricsData.summary.lastSeen)}</span
                >
              </div>
            </Card.Content>
          </Card.Root>

          <Card.Root>
            <Card.Header class="pb-3">
              <Card.Title class="text-sm font-medium">Top services</Card.Title>
            </Card.Header>
            <Card.Content class="space-y-2">
              {#each metricsData.facets.services.slice(0, 8) as service}
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onclick={() => {
                    filters.services = filters.services.includes(service.value)
                      ? filters.services.filter(
                          (value) => value !== service.value,
                        )
                      : [...filters.services, service.value];
                  }}
                >
                  <span class="truncate">{service.value}</span>
                  <span class="text-xs text-muted-foreground"
                    >{formatNumber(service.count)}</span
                  >
                </button>
              {/each}
              {#if metricsData.facets.services.length === 0}
                <p class="py-6 text-center text-sm text-muted-foreground">
                  No service facets.
                </p>
              {/if}
            </Card.Content>
          </Card.Root>
        </div>
      </aside>
    </div>
  </div>
</PageContainer>
