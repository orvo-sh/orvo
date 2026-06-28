<script lang="ts">
  import { goto } from "$app/navigation";
  import { navigating, page } from "$app/state";
  import { Badge } from "@repo/components/ui/badge";
  import * as Select from "@repo/components/ui/select";
  import { formatNumber } from "@repo/utils";
  import MetricsTimeseriesChart from "../_components/metrics-timeseries-chart.svelte";
  import MetricsSummaryCard from "../_components/metrics-summary-card.svelte";
  import { formatMetricValue } from "../format";
  import { createMetricsStateSearchParams } from "../state";

  let { data } = $props();

  const loading = $derived(
    navigating.to?.url.pathname.startsWith(
      `/a/${page.params.app_id}/metrics`,
    ) ?? false,
  );
  const result = $derived(data.metricsResult);
  const selectedMetric = $derived(data.selectedMetric);

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

  const updateAggregation = async (nextAggregation: string) => {
    if (!nextAggregation || nextAggregation === data.aggregation) {
      return;
    }

    const searchParams = createMetricsStateSearchParams({
      time: data.time,
      search: data.search,
      live: data.live,
      aggregation: nextAggregation as typeof data.aggregation,
    });
    await goto(
      searchParams.toString()
        ? `${page.url.pathname}?${searchParams.toString()}`
        : page.url.pathname,
      {
        keepFocus: true,
        noScroll: true,
        replaceState: true,
      },
    );
  };
</script>

<div class="flex h-full min-h-0 flex-col bg-background">
  <div class="border-b bg-background px-4 py-3">
    <div class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">
          {selectedMetric?.name ?? data.metricName}
        </p>
        {#if selectedMetric?.type || selectedMetric?.unit}
          <div class="mt-1 flex flex-wrap items-center gap-2">
            {#if selectedMetric?.type}
              <Badge variant="outline">{selectedMetric.type}</Badge>
            {/if}
            {#if selectedMetric?.unit}
              <Badge variant="secondary">{selectedMetric.unit}</Badge>
            {/if}
          </div>
        {/if}
      </div>

      <div class="w-40">
        <Select.Root
          type="single"
          value={data.aggregation}
          onValueChange={(value) => {
            if (!value) {
              return;
            }

            void updateAggregation(value);
          }}
        >
          <Select.Trigger class="bg-background">
            {data.aggregationOptions.find(
              (option) => option.value === data.aggregation,
            )?.label ?? data.aggregation}
          </Select.Trigger>
          <Select.Content>
            {#each data.aggregationOptions as option}
              <Select.Item value={option.value} label={option.label} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-auto bg-background p-3">
    {#if !result.success}
      <div
        class="border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {result.error}
      </div>
    {:else if !selectedMetric}
      <div class="border px-4 py-10 text-center text-sm text-muted-foreground">
        This metric could not be found for the selected time range.
      </div>
    {:else}
      <div class="grid gap-3">
        <div class="grid gap-3 md:grid-cols-2">
          <MetricsSummaryCard
            title="Latest value"
            value={formatMetricValue(
              selectedMetric.lastValue,
              selectedMetric.unit,
              data.aggregation,
            )}
            meta={formatDateTime(selectedMetric.lastSeen)}
            {loading}
          />
          <MetricsSummaryCard
            title="Points in range"
            value={formatNumber(result.data.summary.totalPoints)}
            meta={data.aggregationOptions.find(
              (option) => option.value === data.aggregation,
            )?.label}
            {loading}
          />
          <MetricsSummaryCard
            title="Services"
            value={formatNumber(selectedMetric.services)}
            meta={`${formatNumber(selectedMetric.containers)} containers`}
            {loading}
          />
          <MetricsSummaryCard
            title="Last point"
            value={formatDateTime(result.data.summary.lastSeen)}
            meta={`${formatNumber(result.data.summary.environmentCount)} environments`}
            {loading}
          />
        </div>

        <MetricsTimeseriesChart
          title={selectedMetric.name}
          series={result.data.series}
          aggregation={data.aggregation}
          unit={selectedMetric.unit}
          {loading}
        />
      </div>
    {/if}
  </div>
</div>
