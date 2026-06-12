<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { formatNumber } from "@repo/utils";
  import {
      IconChartBar,
      IconChevronRight,
      IconRoute,
      IconSparkles,
      IconTerminal2,
  } from "@tabler/icons-svelte";

  import { getInsightsQuery } from "$lib/api/insights.remote";
  import PageContainer from "../../../_components/page-container/page-container.svelte";
  import ChartCard from "./_components/chart-card.svelte";
  import InsightsSection from "./_components/insights-section.svelte";
  import { OnboardingBanner } from "./_components/onboarding-banner";
  import ServicesSection from "./_components/services-section.svelte";
  import SignalSummaryCard from "./_components/signal-summary-card.svelte";

  const { data } = $props();

  let time = $state(data.time);
  let loading = $state(false);
  let dialogOpen = $state(false);
  let allInsights = $state(data.insights ?? []);
  let dialogLoading = $state(false);

  const calculateTrendChange = (current: number, baseline: number) => {
    if (baseline === 0) {
      return current > 0 ? 100 : 0;
    }

    return ((current - baseline) / baseline) * 100;
  };

  const errorRateData = $derived(
    data.traceMetrics?.buckets.map((b) => ({
      timestamp: new Date(b.startAtUtc),
      value: b.errorRate * 100,
    })) ?? [],
  );

  const errorRateTrend = $derived.by(() => {
    const current = data.traceMetrics?.summary.errorRate ?? 0;
    const baseline = data.traceMetrics?.baselineSummary.errorRate ?? 0;

    return {
      change: calculateTrendChange(current, baseline),
    };
  });

  const latencyTrend = $derived.by(() => {
    const current = data.traceMetrics?.summary.p95LatencyMs ?? 0;
    const baseline = data.traceMetrics?.baselineSummary.p95LatencyMs ?? 0;

    return {
      change: calculateTrendChange(current, baseline),
      reverse: true,
    };
  });

  const latencyData = $derived(
    data.traceMetrics?.buckets.map((b) => ({
      timestamp: new Date(b.startAtUtc),
      value: b.p95LatencyMs,
    })) ?? [],
  );

  async function handleViewAll() {
    dialogOpen = true;
    if (allInsights.length <= 3) {
      dialogLoading = true;
      const result = await getInsightsQuery({
        time: { kind: "preset", preset: mapTimeToPreset(time) },
      });
      if (result.success) {
        allInsights = result.data.insights;
      }
      dialogLoading = false;
    }
  }

  function getInsightIcon(category: string) {
    if (category === "error_spike" || category === "active_alert") {
      return IconSparkles;
    }
    if (category === "latency_regression") {
      return IconSparkles;
    }
    if (category === "throughput_drop") {
      return IconSparkles;
    }
    if (category === "new_error_pattern") {
      return IconSparkles;
    }
    if (category === "deployment_impact") {
      return IconSparkles;
    }
    if (category === "metric_anomaly") {
      return IconSparkles;
    }
    return IconSparkles;
  }

  function mapTimeToPreset(
    t: "30m" | "1h" | "4h" | "24h" | "7d",
  ):
    | "last_30_minutes"
    | "last_hour"
    | "last_4_hours"
    | "last_24_hours"
    | "last_7_days" {
    return (
      {
        "30m": "last_30_minutes",
        "1h": "last_hour",
        "4h": "last_4_hours",
        "24h": "last_24_hours",
        "7d": "last_7_days",
      } as const
    )[t];
  }
</script>

<PageContainer title="Overview" class="bg-secondary">
  {#snippet actions()}
    <div class="flex gap-1 rounded-lg border bg-background p-1">
      {#each ["30m", "1h", "4h", "24h", "7d"] as const as t}
        <Button
          class={"h-6"}
          variant={time == t ? "default" : "ghost"}
          size="sm"
          onclick={() => {
            if (loading) return;
            loading = true;
            time = t;
            const url = new URL(page.url);
            url.searchParams.set("t", t);
            goto(url).then(() => {
              loading = false;
            });
          }}
        >
          {t}
        </Button>
      {/each}
    </div>
  {/snippet}
  <div class="flex flex-col gap-4">
    {#if !data.hasReceivedFirstSignal}
      <OnboardingBanner ingestionKey={data.ingestionKey ?? ""} />
    {/if}
    <section class="grid gap-3 lg:grid-cols-3">
      <SignalSummaryCard
        icon={IconTerminal2}
        title="Logs"
        value={`${formatNumber(data.logTrend?.total ?? 0)} records`}
        trend={data.logTrend?.trend ?? 0}
        href={`/a/${page.params.app_id}/logs`}
        {loading}
      />
      <SignalSummaryCard
        icon={IconRoute}
        title="Traces"
        value={`${formatNumber(data.traceTrend?.total ?? 0)} traces`}
        trend={data.traceTrend?.trend ?? 0}
        href={`/a/${page.params.app_id}/traces`}
        {loading}
      />
      <SignalSummaryCard
        icon={IconChartBar}
        title="Metrics"
        value={`${formatNumber(data.metricsTrend?.total ?? 0)} points`}
        trend={data.metricsTrend?.trend ?? 0}
        href={`/a/${page.params.app_id}/metrics`}
        {loading}
      />
    </section>
    <section class="grid gap-3 lg:grid-cols-2">
      <ChartCard
        title="Error rate"
        data={errorRateData}
        color="var(--color-destructive)"
        valueFormatter={(v) => `${v.toFixed(2)}%`}
        summaryValue={(data.traceMetrics?.summary.errorRate ?? 0) * 100}
        trend={errorRateTrend}
        yDomain={[0, null]}
        yFormat={(v) => `${v.toFixed(1)}%`}
        {loading}
      />
      <ChartCard
        title="p95 latency"
        data={latencyData}
        color="var(--color-primary)"
        valueFormatter={(v) => `${Math.round(v)}ms`}
        summaryValue={data.traceMetrics?.summary.p95LatencyMs ?? 0}
        trend={latencyTrend}
        yFormat={(v) => `${Math.round(v)} ms`}
        yDomain={[0, null]}
        {loading}
      />
    </section>

    <InsightsSection
      insights={data.insights ?? []}
      {loading}
      onViewAll={handleViewAll}
    />

    <ServicesSection
      services={data.servicesNeedingAttention ?? []}
      {time}
      {loading}
    />
  </div>
</PageContainer>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <div class="flex items-center gap-2">
        <IconSparkles class="size-4 text-primary" />
        <Dialog.Title class="text-sm font-semibold">All insights</Dialog.Title>
        {#if allInsights.length > 0}
          <span
            class="inline-flex h-5 items-center justify-center rounded-full border border-transparent bg-secondary px-2 text-xs font-medium text-secondary-foreground"
          >
            {allInsights.length}
          </span>
        {/if}
      </div>
      <Dialog.Description class="sr-only">
        Full list of insights for the selected time window.
      </Dialog.Description>
    </Dialog.Header>

    {#if dialogLoading}
      <div class="flex items-center justify-center py-8">
        <div
          class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        ></div>
      </div>
    {:else if allInsights.length === 0}
      <div class="py-6 text-center text-sm text-muted-foreground">
        No insights for this period.
      </div>
    {:else}
      <div class="divide-y divide-border/70">
        {#each allInsights as insight (insight.id)}
          {@const InsightIcon = getInsightIcon(insight.category)}
          <div class="flex items-center gap-3 py-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg {insight.severity ===
              'critical'
                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                : insight.severity === 'warning'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                  : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}"
            >
              <InsightIcon class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{insight.title}</p>
              <p class="line-clamp-2 text-xs text-muted-foreground">
                {insight.body}
              </p>
            </div>
            {#if insight.link}
              <a
                href={insight.link}
                class="flex shrink-0 items-center text-muted-foreground hover:text-foreground"
              >
                <IconChevronRight class="size-4" />
              </a>
            {:else}
              <div class="size-4 shrink-0"></div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
