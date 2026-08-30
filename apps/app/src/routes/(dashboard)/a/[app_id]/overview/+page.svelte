<script lang="ts">
  import { goto } from "$app/navigation";
  import * as Chat from "$lib/chat";
  import { Button } from "@repo/components/ui/button";
  import * as Select from "@repo/components/ui/select";
  import { formatNumber } from "@repo/utils";
  import { IconChartBar, IconRoute, IconTerminal2 } from "@tabler/icons-svelte";

  import { page } from "$app/state";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import ChartCard from "./_components/chart-card.svelte";
  import IncidentsSection from "./_components/incidents-section.svelte";
  import { OnboardingBanner } from "./_components/onboarding-banner";
  import ServicesSection from "./_components/services-section.svelte";
  import SignalSummaryCard from "./_components/signal-summary-card.svelte";

  const { data } = $props();
  const timeOptions = ["30m", "1h", "4h", "24h", "7d"] as const;

  let time = $state(data.time);
  let loading = $state(false);

  const chat = Chat.useChatState();

  const updateTime = async (nextTime: (typeof timeOptions)[number]) => {
    if (loading || time === nextTime) {
      return;
    }

    loading = true;
    time = nextTime;

    const url = new URL(page.url);
    url.searchParams.set("t", nextTime);

    try {
      await goto(url);
    } finally {
      loading = false;
    }
  };

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

  const overviewChatContext = $derived<Chat.ChatContextDescriptor>({
    kind: "overview",
    resourceId: "overview",
    label: "Overview",
    metadata: {
      layout:
        "Top to bottom: Logs, Traces, and Metrics signal summaries; Error rate chart on the left and p95 latency chart on the top right on wide screens (stacked on narrow screens); Open incidents; Services needing attention. The time filter is in the page header.",
      timeFilter: `last ${time}`,
      logsTotal: data.logTrend?.total ?? 0,
      tracesTotal: data.traceTrend?.total ?? 0,
      metricPointsTotal: data.metricsTrend?.total ?? 0,
      errorRatePercent: (data.traceMetrics?.summary.errorRate ?? 0) * 100,
      errorRateChangePercent: errorRateTrend.change,
      p95LatencyMs: data.traceMetrics?.summary.p95LatencyMs ?? 0,
      p95LatencyChangePercent: latencyTrend.change,
      openIncidentCount: data.incidents?.length ?? 0,
      servicesNeedingAttention: (
        data.servicesNeedingAttention
          ?.map((service) => service.name)
          .join(", ") || "None"
      ).slice(0, 500),
      hasReceivedTelemetry: data.hasReceivedFirstSignal,
    },
  });

  $effect(() => {
    if (
      chat.railOpen &&
      chat.context?.kind === "overview" &&
      chat.context !== overviewChatContext
    ) {
      chat.context = overviewChatContext;
    }
  });
</script>

<PageContainer title="Overview" contentClass="p-3" scout={overviewChatContext}>
  {#snippet actions()}
    <Select.Root
      type="single"
      value={time}
      onValueChange={(nextTime) => {
        if (!nextTime) return;
        void updateTime(nextTime as (typeof timeOptions)[number]);
      }}
    >
      <Select.Trigger
        size="sm"
        class="h-8.5! min-w-16 rounded-lg! bg-background py-0 sm:hidden"
      >
        last {time}
      </Select.Trigger>
      <Select.Content>
        {#each timeOptions as option}
          <Select.Item value={option} label={"last " + option} />
        {/each}
      </Select.Content>
    </Select.Root>

    <div class="hidden gap-1 rounded-lg border bg-secondary p-0.75 sm:flex">
      {#each timeOptions as t}
        <Button
          class="h-6"
          variant={time == t ? "default" : "ghost"}
          size="sm"
          onclick={() => {
            void updateTime(t);
          }}
        >
          {t}
        </Button>
      {/each}
    </div>
  {/snippet}
  <div class="flex flex-col">
    {#if !data.hasReceivedFirstSignal}
      <OnboardingBanner ingestionKey={data.ingestionKey ?? ""} />
    {/if}
    <section class="grid gap-3 pb-3 lg:grid-cols-3">
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

    <IncidentsSection
      incidents={data.incidents ?? []}
      {loading}
      onViewAll={() => {
        void goto(`/a/${page.params.app_id}/incidents`);
      }}
      appId={page.params.app_id ?? ""}
    />

    <ServicesSection
      services={(data.servicesNeedingAttention ?? []) as Array<{
        name: string;
        total: number;
        errors: number;
        errorRate: number;
        p95LatencyMs: number;
        severity: "critical" | "warning" | "info";
        buckets: number[];
      }>}
      {time}
      {loading}
    />
  </div>
</PageContainer>
