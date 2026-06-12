<script lang="ts">
  import * as Accordion from "@repo/components/ui/accordion";
  import { Badge } from "@repo/components/ui/badge";
  import * as Card from "@repo/components/ui/card";
  import { formatNumber } from "@repo/utils";
  import {
    IconActivity,
    IconAlertTriangle,
    IconBell,
    IconChevronRight,
    IconClock,
    IconEyeSpark,
    IconGitCommit,
    IconSparkles,
    IconTrendingDown,
    IconTrendingUp,
    IconTriangle,
  } from "@tabler/icons-svelte";

  type Trend = { up: boolean; change: number };

  let {
    loading,
    requestVolume,
    requestVolumeTrend,
    errorRate,
    errorRateTrend,
    p95Latency,
    p95LatencyTrend,
    logVolume,
    alertRules,
    deployments,
    insights,
  }: {
    loading: boolean;
    requestVolume: number;
    requestVolumeTrend: Trend;
    errorRate: number;
    errorRateTrend: Trend;
    p95Latency: number;
    p95LatencyTrend: Trend;
    logVolume: { buckets: LogVolumeBucket[] } | null;
    alertRules: AlertRule[];
    deployments: Deployment[];
    insights: InsightItem[];
  } = $props();

  type InsightItem = {
    id: string;
    title: string;
    body: string;
    severity: "critical" | "warning" | "info";
    category: string;
    score: number;
    serviceName?: string;
    link?: string;
  };

  type LogVolumeBucket = {
    startAtUtc: string;
    endAtUtc: string;
    fatal: number;
    error: number;
    warn: number;
    info: number;
    debug: number;
    trace: number;
    total: number;
  };

  type TraceSummary = {
    total: number;
    errorTraces: number;
    errorRate: number;
    p95LatencyMs: number;
    serviceCount: number;
    startAtUtc: string;
    endAtUtc: string;
  };

  type AlertRule = {
    id: string;
    name: string;
    openIncident: { id: string; status: string } | null;
  };

  type Deployment = {
    id: string;
    serviceName: string;
    environmentName: string;
    version: string | null;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
  };

  const errorLogs = $derived(
    logVolume?.buckets.reduce(
      (sum, b) => sum + Number(b.error) + Number(b.fatal),
      0,
    ) ?? 0,
  );
  const activeAlerts = $derived(
    alertRules.filter((r) => r.openIncident != null).length,
  );
  const lastDeployment = $derived(deployments[0] ?? null);
  const hasData = $derived((logVolume?.buckets.length ?? 0) > 0);

  const maxBucket = $derived(
    Math.max(...(logVolume?.buckets.map((b) => Number(b.total)) ?? [1]), 1),
  );

  function timeAgo(date: Date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  }
</script>

<div>
  <Card.Root class="relative">
    {#if loading}
      <div
        class="absolute top-0 z-50 h-full w-full bg-background opacity-60"
      ></div>
    {/if}
    <Card.Header class="border-b">
      <Card.Title>App health</Card.Title>
    </Card.Header>
    <Card.Content>
      <div class="grid gap-4 sm:grid-cols-3">
        {@render statCard({
          icon: IconActivity,
          label: "Request volume",
          value: formatNumber(requestVolume),
          trend: requestVolumeTrend,
        })}
        {@render statCard({
          icon: IconAlertTriangle,
          label: "Error rate",
          value: `${errorRate.toFixed(1)}%`,
          valueColor:
            errorRate > 5
              ? "text-red-600 dark:text-red-400"
              : errorRate > 1
                ? "text-amber-600 dark:text-amber-400"
                : "text-green-600 dark:text-green-400",
          trend: errorRateTrend,
          trendColor: errorRate > 1 ? "text-red-500" : "text-green-500",
        })}
        {@render statCard({
          icon: IconClock,
          label: "P95 latency",
          value: `${Math.round(p95Latency)}ms`,
          trend: p95LatencyTrend,
          trendColor: p95Latency > 500 ? "text-red-500" : "text-green-500",
        })}
      </div>
    </Card.Content>

    <div>
      <!-- Changes -->
      <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 pt-4">
        {#if lastDeployment}
          <div class="flex items-center gap-1.5">
            <IconGitCommit class="size-3.5 text-muted-foreground" />
            <span class="text-xs text-muted-foreground">
              {#if lastDeployment.version}
                <code class="rounded bg-muted px-1 py-0.5 text-[10px]">
                  {lastDeployment.version.slice(0, 7)}
                </code>
              {/if}
              <span class="ml-1">{timeAgo(lastDeployment.startedAt)}</span>
            </span>
          </div>
        {:else}
          <div class="flex items-center gap-1.5">
            <IconGitCommit class="size-3.5 text-muted-foreground" />
            <span class="text-xs text-muted-foreground">No deployments</span>
          </div>
        {/if}

        <div class="flex items-center gap-1.5">
          <IconTriangle class="size-3.5 text-muted-foreground" />
          <span class="text-xs text-muted-foreground">
            {errorLogs > 0 ? formatNumber(errorLogs) : "0"} errors
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <IconBell class="size-3.5 text-muted-foreground" />
          <span class="text-xs text-muted-foreground">
            {activeAlerts} active alerts
          </span>
        </div>
      </div>

      <!-- Log volume sparkline -->
      {#if logVolume && hasData}
        <div class="mt-5">
          <div class="flex h-16 items-end gap-px">
            {#each logVolume.buckets as bucket}
              <div
                class="flex-1 rounded-sm bg-primary/50"
                style={`height: ${Math.max((bucket.total / maxBucket) * 100, 2)}%`}
              ></div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    <div class="px-3 pb-2">
      <Accordion.Root type="single" class="w-full">
        <Accordion.Item value="insights">
          <Accordion.Trigger
            class="-mb-2 border-border bg-muted p-3 py-2 pr-2 hover:no-underline"
          >
            <div class="flex min-w-0 items-center gap-2">
              <IconEyeSpark class="size-4 opacity-80" />
              <span class="font-medium">Insights</span>
              {#if insights.length > 0}
                <Badge
                  variant="secondary"
                  class="rounded-full px-2 py-0.5 text-xs"
                >
                  {insights.length}
                </Badge>
              {/if}
            </div>
          </Accordion.Trigger>
          <Accordion.Content
            class="rounded-md rounded-t-none border bg-secondary p-3"
          >
            content
            {#if insights.length > 0}
              <div class="divide-y divide-border/70">
                {#each insights as insight}
                  <div class="flex items-start gap-3 px-4 py-3">
                    <IconSparkles
                      class="mt-0.5 size-4 shrink-0 {insight.severity ===
                      'critical'
                        ? 'text-red-500'
                        : insight.severity === 'warning'
                          ? 'text-amber-500'
                          : 'text-primary'}"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium">{insight.title}</p>
                        {#if insight.severity === "critical"}
                          <Badge
                            variant="secondary"
                            class="rounded-full bg-red-50 px-2 py-0 text-[10px] text-red-700 dark:bg-red-900/20 dark:text-red-400"
                          >
                            Critical
                          </Badge>
                        {:else if insight.severity === "warning"}
                          <Badge
                            variant="secondary"
                            class="rounded-full bg-amber-50 px-2 py-0 text-[10px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                          >
                            Warning
                          </Badge>
                        {/if}
                      </div>
                      <p class="text-sm text-muted-foreground">
                        {insight.body}
                      </p>
                      {#if insight.link}
                        <a
                          href={insight.link}
                          class="mt-1 inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                        >
                          Investigate
                          <IconChevronRight class="size-3" />
                        </a>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  </Card.Root>
</div>

{#snippet statCard(metric: {
  icon: typeof IconActivity;
  label: string;
  value: string;
  valueColor?: string;
  trend?: Trend;
  trendColor?: string;
})}
  <div class="flex items-center gap-3">
    <div
      class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
    >
      <metric.icon class="size-4" />
    </div>
    <div class="min-w-0">
      <p class="text-xs text-muted-foreground">{metric.label}</p>
      <div class="flex items-center gap-1.5">
        <p
          class="text-lg leading-tight font-semibold tabular-nums {metric.valueColor ??
            ''}"
        >
          {metric.value}
        </p>
        {#if metric.trend}
          <span
            class="flex items-center gap-0.5 text-xs {metric.trendColor ?? ''}"
          >
            {#if metric.trend.up}
              <IconTrendingUp class="size-3" />
            {:else}
              <IconTrendingDown class="size-3" />
            {/if}
            {#if metric.trend.change !== 0}
              {metric.trend.change > 0 ? "+" : ""}{metric.trend.change.toFixed(
                1,
              )}%
            {/if}
          </span>
        {/if}
      </div>
    </div>
  </div>
{/snippet}
