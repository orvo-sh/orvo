<script lang="ts">
  import { Badge } from "@repo/components/ui/badge";
  import * as Card from "@repo/components/ui/card";
  import {
    IconBell,
    IconChevronDown,
    IconChevronRight,
    IconGitCommit,
    IconSparkles,
    IconTriangle,
  } from "@tabler/icons-svelte";

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

  let {
    timePreset,
    timeOptions,
    logVolume,
    traceSummary,
    alertRules,
    deployments,
    insights,
    onTimePresetChange,
  }: {
    timePreset: string;
    timeOptions: Array<{ label: string; preset: string }>;
    logVolume: { buckets: LogVolumeBucket[] } | null;
    traceSummary: TraceSummary | null;
    alertRules: AlertRule[];
    deployments: Deployment[];
    insights: InsightItem[];
    onTimePresetChange: (preset: string) => void;
  } = $props();

  let insightsOpen = $state(false);

  const totalLogs = $derived(
    logVolume?.buckets.reduce((sum, b) => sum + b.total, 0) ?? 0,
  );
  const errorLogs = $derived(
    logVolume?.buckets.reduce((sum, b) => sum + b.error + b.fatal, 0) ?? 0,
  );
  const totalRequests = $derived(totalLogs + (traceSummary?.total ?? 0));
  const errorRate = $derived(
    totalRequests > 0
      ? ((errorLogs + (traceSummary?.errorTraces ?? 0)) / totalRequests) * 100
      : 0,
  );
  const p95Latency = $derived(traceSummary?.p95LatencyMs ?? 0);
  const serviceCount = $derived(traceSummary?.serviceCount ?? 0);
  const activeAlerts = $derived(
    alertRules.filter((r) => r.openIncident != null).length,
  );
  const lastDeployment = $derived(deployments[0] ?? null);
  const hasData = $derived(totalRequests > 0);

  const statusLabel = $derived(
    !hasData
      ? "No data"
      : errorRate > 5
        ? "Degraded"
        : errorRate > 1
          ? "Warning"
          : "Healthy",
  );

  const statusColor = $derived(
    !hasData
      ? "text-muted-foreground"
      : errorRate > 5
        ? "text-red-600 dark:text-red-400"
        : errorRate > 1
          ? "text-amber-600 dark:text-amber-400"
          : "text-green-600 dark:text-green-400",
  );

  const statusDot = $derived(
    !hasData
      ? "bg-muted-foreground"
      : errorRate > 5
        ? "bg-red-500"
        : errorRate > 1
          ? "bg-amber-500"
          : "bg-green-500",
  );

  const statusBorderClass = $derived(
    !hasData
      ? "border-border"
      : errorRate > 5
        ? "border-red-500/25"
        : errorRate > 1
          ? "border-amber-500/25"
          : "border-green-500/25",
  );

  const summaryText = $derived(
    !hasData
      ? "No telemetry in the selected window."
      : errorRate > 5
        ? `Error rate elevated at ${errorRate.toFixed(1)}%. Check deployments and alerts.`
        : errorRate > 1
          ? `Error rate at ${errorRate.toFixed(1)}%. Monitoring for trends.`
          : `Telemetry flowing normally. Error rate is ${errorRate.toFixed(1)}%.`,
  );

  const timeLabel = $derived(
    traceSummary?.startAtUtc
      ? formatTimeWindow(traceSummary.startAtUtc, traceSummary.endAtUtc)
      : (timeOptions.find((o) => o.preset === timePreset)?.label ?? "1h"),
  );

  const maxBucket = $derived(
    Math.max(...(logVolume?.buckets.map((b) => b.total) ?? [1]), 1),
  );

  function formatTimeWindow(startIso: string, endIso: string) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const diffMin = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (diffMin < 60) return `Last ${diffMin}m`;
    return `Last ${Math.round(diffMin / 60)}h`;
  }

  function formatNumber(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toString();
  }

  function timeAgo(date: Date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  }
</script>

<Card.Root>
  <Card.Header class="border-b">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Card.Title class="text-sm font-medium">App health</Card.Title>
        <Badge
          variant="outline"
          class="gap-1.5 text-[10px] font-medium {statusBorderClass} {statusColor}"
        >
          <span class="size-1.5 rounded-full {statusDot}"></span>
          {statusLabel}
        </Badge>
      </div>
      <div class="flex items-center gap-0.5">
        {#each timeOptions as opt}
          <button
            class="rounded-md px-2 py-1 text-xs font-medium transition-colors {opt.preset ===
            timePreset
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
            class:bg-muted={opt.preset === timePreset}
            onclick={() => onTimePresetChange(opt.preset)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>
  </Card.Header>

  <div class="p-4 lg:p-5">
    <!-- Summary line -->
    <div class="flex items-center gap-3">
      <span class="text-xs text-muted-foreground tabular-nums">{timeLabel}</span
      >
      <span class="text-sm text-muted-foreground">{summaryText}</span>
    </div>

    <!-- Metrics -->
    <div class="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p class="text-xs text-muted-foreground">Requests</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">
          {formatNumber(totalRequests)}
        </p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">Error rate</p>
        <p class="mt-1 text-lg font-semibold tabular-nums {statusColor}">
          {hasData ? `${errorRate.toFixed(1)}%` : "—"}
        </p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">P95 latency</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">
          {p95Latency > 0 ? `${Math.round(p95Latency)}ms` : "—"}
        </p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">Services</p>
        <p class="mt-1 text-lg font-semibold tabular-nums">
          {serviceCount > 0 ? `${serviceCount} healthy` : "—"}
        </p>
      </div>
    </div>

    <!-- Changes -->
    <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-4">
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

  <!-- Insights -->
  <button
    class="flex w-full items-center justify-between gap-4 border-t border-border/70 px-4 py-3 text-sm transition-colors hover:bg-muted/35"
    onclick={() => (insightsOpen = !insightsOpen)}
  >
    <div class="flex min-w-0 items-center gap-3">
      {#if insightsOpen}
        <IconChevronDown class="size-4 shrink-0 text-muted-foreground" />
      {:else}
        <IconChevronRight class="size-4 shrink-0 text-muted-foreground" />
      {/if}
      <span class="font-medium">Insights</span>
      {#if insights.length > 0}
        <Badge variant="secondary" class="rounded-full px-2 py-0.5 text-xs">
          {insights.length}
        </Badge>
      {/if}
    </div>
    <span class="hidden text-xs text-muted-foreground sm:block">
      {insightsOpen ? "Hide" : "Show"} recommendations
    </span>
  </button>

  {#if insightsOpen && insights.length > 0}
    <div class="border-t border-border/70">
      <div class="divide-y divide-border/70">
        {#each insights as insight}
          <div class="flex items-start gap-3 px-4 py-3">
            <IconSparkles
              class="mt-0.5 size-4 shrink-0 {insight.severity === 'critical'
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
              <p class="text-sm text-muted-foreground">{insight.body}</p>
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
    </div>
  {/if}
</Card.Root>
