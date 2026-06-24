<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { markOrganizationActivationTelemetryViewedCommand } from "$lib/api/organization-activation.remote";
  import * as RightRail from "$lib/right-rail";
  import {
    completeOrganizationActivationStep,
    restoreOrganizationActivation,
  } from "$lib/stores/organization-activation.svelte";
  import { Button } from "@repo/components/ui/button";
  import * as Select from "@repo/components/ui/select";
  import { formatNumber } from "@repo/utils";
  import { IconChartBar, IconRoute, IconTerminal2 } from "@tabler/icons-svelte";

  import PageContainer from "../_components/page-container/page-container.svelte";
  import ChartCard from "./_components/chart-card.svelte";
  import IncidentsSection from "./_components/incidents-section.svelte";
  import { OnboardingBanner } from "./_components/onboarding-banner";
  import ServiceSheet from "./_components/service-sheet.svelte";
  import ServicesSection from "./_components/services-section.svelte";
  import SignalSummaryCard from "./_components/signal-summary-card.svelte";

  const { data } = $props();
  const timeOptions = ["30m", "1h", "4h", "24h", "7d"] as const;

  let time = $state(data.time);
  let loading = $state(false);
  let telemetryActivationSent = $state(false);
  let selectedServiceName = $state<string | null>(null);

  const rightRail = RightRail.useRightRail();

  const selectedService = $derived(
    (data.servicesNeedingAttention ?? []).find(
      (service) => service.name === selectedServiceName,
    ) ?? null,
  );

  const selectedServiceConnections = $derived.by(() => {
    if (!selectedServiceName) {
      return { incoming: [], outgoing: [] };
    }

    const incoming = new Map<
      string,
      { name: string; total: number; errors: number; errorRate: number }
    >();
    const outgoing = new Map<
      string,
      { name: string; total: number; errors: number; errorRate: number }
    >();

    for (const edge of data.serviceGraph?.edges ?? []) {
      if (edge.target === selectedServiceName) {
        incoming.set(edge.source, {
          name: edge.source,
          total: edge.total,
          errors: edge.errors,
          errorRate: edge.errorRate,
        });
      }

      if (edge.source === selectedServiceName) {
        outgoing.set(edge.target, {
          name: edge.target,
          total: edge.total,
          errors: edge.errors,
          errorRate: edge.errorRate,
        });
      }
    }

    return {
      incoming: Array.from(incoming.values()).sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }

        return right.errors - left.errors;
      }),
      outgoing: Array.from(outgoing.values()).sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }

        return right.errors - left.errors;
      }),
    };
  });

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

    if (!data.hasReceivedFirstSignal) {
      return;
    }

    void markTelemetryViewed();
  });

  $effect(() => {
    if (selectedServiceName && !selectedService) {
      selectedServiceName = null;
    }
  });

  $effect(() => {
    if (!selectedService) {
      rightRail.close("overview-service");
      return;
    }

    rightRail.show({
      id: "overview-service",
      component: ServiceSheet,
      persistOnNavigation: false,
      widthClass: "sm:max-w-3xl",
      props: {
        service: selectedService,
        incomingServices: selectedServiceConnections.incoming,
        outgoingServices: selectedServiceConnections.outgoing,
        time,
        onClose: () => {
          selectedServiceName = null;
        },
      },
    });
  });
</script>

<PageContainer title="Overview">
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
      {selectedServiceName}
      onSelectService={(serviceName) => {
        selectedServiceName =
          selectedServiceName === serviceName ? null : serviceName;
      }}
      {time}
      {loading}
    />
  </div>
</PageContainer>
