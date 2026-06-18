<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { markOrganizationActivationTelemetryViewedCommand } from "$lib/api/organization-activation.remote";
  import {
    completeOrganizationActivationStep,
    restoreOrganizationActivation,
  } from "$lib/stores/organization-activation.svelte";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import * as Select from "@repo/components/ui/select";
  import { formatNumber } from "@repo/utils";
  import {
    IconAlertTriangle,
    IconChartBar,
    IconChevronRight,
    IconRoute,
    IconTerminal2,
  } from "@tabler/icons-svelte";

  import { getOpenIncidentsQuery } from "$lib/api/incidents.remote";
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
  let dialogOpen = $state(false);
  let allIncidents = $state(data.incidents ?? []);
  let dialogLoading = $state(false);
  let telemetryActivationSent = $state(false);

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

  async function handleViewAll() {
    dialogOpen = true;
    if (allIncidents.length <= 3) {
      dialogLoading = true;
      const result = await getOpenIncidentsQuery({});
      if (result.success) {
        allIncidents = result.data.incidents;
      }
      dialogLoading = false;
    }
  }

  function formatIncidentTimeAgo(value: Date) {
    const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

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
</script>

<PageContainer title="Overview">
  {#snippet helper()}
    <div class="space-y-2">
      <p>
        Overview shows a high-level summary of your app's health and recent
        telemetry.
      </p>
      <p>
        Use it to spot trends in logs, traces, and metrics, and to quickly see
        any open incidents or services that need attention.
      </p>
    </div>
  {/snippet}
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

    <div class="hidden gap-1 rounded-lg border bg-muted p-0.75 sm:flex">
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
      onViewAll={handleViewAll}
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

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <div class="flex items-center gap-2">
        <IconAlertTriangle class="size-4 text-destructive" />
        <Dialog.Title class="text-sm font-semibold"
          >All open incidents</Dialog.Title
        >
        {#if allIncidents.length > 0}
          <span
            class="inline-flex h-5 items-center justify-center rounded-full border border-transparent bg-secondary px-2 text-xs font-medium text-secondary-foreground"
          >
            {allIncidents.length}
          </span>
        {/if}
      </div>
      <Dialog.Description class="sr-only">
        Full list of open alert incidents for this app.
      </Dialog.Description>
    </Dialog.Header>

    {#if dialogLoading}
      <div class="flex items-center justify-center py-8">
        <div
          class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
        ></div>
      </div>
    {:else if allIncidents.length === 0}
      <div class="py-6 text-center text-sm text-muted-foreground">
        No open incidents.
      </div>
    {:else}
      <div class="divide-y divide-border/70">
        {#each allIncidents as incident (incident.id)}
          <a
            href={`/a/${page.params.app_id}/alerts`}
            class="flex items-center gap-3 py-3"
          >
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              <IconAlertTriangle class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{incident.rule.name}</p>
              <p class="line-clamp-2 text-xs text-muted-foreground">
                {incident.rule.signalType}
                {#if incident.lastObservedValue !== null}
                  · value {incident.lastObservedValue}
                {/if}
                · open for {formatIncidentTimeAgo(incident.openedAt)}
              </p>
            </div>
            <IconChevronRight class="size-4 shrink-0 text-muted-foreground" />
          </a>
        {/each}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
