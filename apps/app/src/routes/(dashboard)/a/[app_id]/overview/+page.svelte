<script lang="ts">
  import { page } from "$app/state";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import {
    IconBell,
    IconChevronDown,
    IconChevronRight,
    IconGitCommit,
    IconRoute,
    IconSparkles,
    IconTerminal2,
    IconTriangle,
  } from "@tabler/icons-svelte";

  import PageContainer from "../../../_components/page-container/page-container.svelte";

  type PageData = {
    appName: string;
    logVolume: {
      buckets: Array<{
        startAtUtc: string;
        endAtUtc: string;
        fatal: number;
        error: number;
        warn: number;
        info: number;
        debug: number;
        trace: number;
        total: number;
      }>;
    } | null;
    traceSummary: {
      total: number;
      errorTraces: number;
      errorRate: number;
      p95LatencyMs: number;
      serviceCount: number;
      startAtUtc: string;
      endAtUtc: string;
    } | null;
    alerts: {
      rules: Array<{
        id: string;
        name: string;
        openIncident: { id: string; status: string } | null;
      }>;
    } | null;
    deployments: {
      deployments: Array<{
        id: string;
        serviceName: string;
        environmentName: string;
        version: string | null;
        status: string;
        startedAt: Date;
        finishedAt: Date | null;
      }>;
    } | null;
    services: {
      services: Array<{
        name: string;
        total: number;
        errors: number;
        lastSeen: string;
      }>;
    } | null;
  };

  const data = $derived(page.data as PageData);
  const appName = $derived(data.appName);
  const logVolume = $derived(data.logVolume);
  const traceSummary = $derived(data.traceSummary);
  const alertRules = $derived(data.alerts?.rules ?? []);
  const deployments = $derived(data.deployments?.deployments ?? []);
  const services = $derived(data.services?.services ?? []);

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
  const serviceCount = $derived(traceSummary?.serviceCount ?? services.length);
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
      ? ""
      : errorRate > 5
        ? "border-red-500/30"
        : errorRate > 1
          ? "border-amber-500/30"
          : "border-green-500/30",
  );

  const statusTextClass = $derived(
    !hasData
      ? ""
      : errorRate > 5
        ? "text-red-600 dark:text-red-400"
        : errorRate > 1
          ? "text-amber-600 dark:text-amber-400"
          : "text-green-600 dark:text-green-400",
  );

  const summaryText = $derived(
    !hasData
      ? "No telemetry received in the last hour."
      : errorRate > 5
        ? `Error rate is elevated at ${errorRate.toFixed(1)}%. Check recent deployments and alert rules.`
        : errorRate > 1
          ? `Error rate at ${errorRate.toFixed(1)}%. Monitoring for trends.`
          : `Telemetry is flowing normally. Error rate is ${errorRate.toFixed(1)}%.`,
  );

  const timeLabel = $derived(
    traceSummary?.startAtUtc
      ? formatTimeWindow(traceSummary.startAtUtc, traceSummary.endAtUtc)
      : "Last 1h",
  );

  let insightsOpen = $state(false);

  const insights = $derived(
    [
      {
        title: "Error rate spike",
        body: `Error rate increased 18% after deployment ${lastDeployment?.version?.slice(0, 7) ?? "unknown"}`,
        severity: "warning" as const,
      },
      {
        title: "Latency regression",
        body: `${services[0]?.name ?? "API"} latency increased from 120ms to 340ms`,
        severity: "warning" as const,
      },
    ].slice(0, services.length > 0 ? 2 : 0),
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
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  }

  const appId = $derived(page.params.app_id);

  const maxBucket = $derived(
    Math.max(...(logVolume?.buckets.map((b) => b.total) ?? [1]), 1),
  );
</script>

<PageContainer title="Overview" class="bg-secondary">
  <div class="mx-auto flex w-full flex-col gap-5">
    <Card.Root>
      <Card.Header class="border-b">
        <Card.Title class="flex h-full items-center gap-2">
          App health
        </Card.Title>
        <Card.Action>
          <Button href={`/a/${appId}/chat`} variant="outline">
            <IconSparkles data-slot="button-icon" />
            Ask Orvo
          </Button>
          <Button href={`/a/${appId}/logs`}>
            <IconTerminal2 data-slot="button-icon" />
            Investigate
          </Button>
        </Card.Action>
      </Card.Header>

      <div class="p-4 lg:p-5">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div>
                <p class="text-sm text-muted-foreground">App</p>
                <div class="mt-0.5 flex items-center gap-2">
                  <h2
                    class="text-lg font-semibold tracking-tight text-foreground"
                  >
                    {appName}
                  </h2>
                  <Badge
                    variant="outline"
                    class="gap-1 text-xs {statusBorderClass} {statusTextClass}"
                  >
                    <span class="size-1.5 rounded-full {statusDot}"></span>
                    {statusLabel}
                  </Badge>
                </div>
              </div>
              <div class="text-xs text-muted-foreground">{timeLabel}</div>
            </div>

            <p class="mt-3 text-sm text-muted-foreground">{summaryText}</p>

            <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p class="text-xs text-muted-foreground">Requests</p>
                <p class="mt-0.5 text-lg font-semibold tabular-nums">
                  {formatNumber(totalRequests)}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Error rate</p>
                <p
                  class="mt-0.5 text-lg font-semibold tabular-nums {statusColor}"
                >
                  {hasData ? `${errorRate.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">P95 latency</p>
                <p class="mt-0.5 text-lg font-semibold tabular-nums">
                  {p95Latency > 0 ? `${Math.round(p95Latency)}ms` : "—"}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Services</p>
                <p class="mt-0.5 text-lg font-semibold tabular-nums">
                  {serviceCount > 0 ? `${serviceCount} healthy` : "—"}
                </p>
              </div>
            </div>
          </div>

          <div class="w-full lg:w-72 xl:w-80">
            <p class="text-sm font-medium">Changes</p>
            <div class="mt-2 space-y-3">
              {#if lastDeployment}
                <div class="flex items-start gap-2">
                  <IconGitCommit
                    class="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  />
                  <div class="min-w-0">
                    <p class="text-sm">
                      Last deployment
                      {#if lastDeployment.version}
                        <code class="ml-1 rounded bg-muted px-1 py-0.5 text-xs">
                          {lastDeployment.version.slice(0, 7)}
                        </code>
                      {/if}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {timeAgo(lastDeployment.startedAt)}
                    </p>
                  </div>
                </div>
              {:else}
                <p class="text-sm text-muted-foreground">
                  No recent deployments
                </p>
              {/if}

              <div class="flex items-start gap-2">
                <IconTriangle
                  class="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                />
                <div>
                  <p class="text-sm">
                    New errors: {errorLogs > 0 ? formatNumber(errorLogs) : "0"}
                  </p>
                </div>
              </div>

              <div class="flex items-start gap-2">
                <IconBell
                  class="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                />
                <div>
                  <p class="text-sm">
                    Active alerts: {activeAlerts}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {#if logVolume && hasData}
          <div class="mt-6">
            <div class="flex h-20 items-end gap-px">
              {#each logVolume.buckets as bucket, i}
                <div
                  class="flex-1 rounded-sm bg-primary/60"
                  style={`height: ${Math.max((bucket.total / maxBucket) * 100, 2)}%`}
                ></div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

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
                <IconSparkles class="mt-0.5 size-4 shrink-0 text-primary" />
                <div class="min-w-0">
                  <p class="text-sm font-medium">{insight.title}</p>
                  <p class="text-sm text-muted-foreground">{insight.body}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </Card.Root>

    <section class="grid gap-5 lg:grid-cols-3">
      <a
        href={`/a/${appId}/logs`}
        class="group rounded-xl border bg-background p-4 transition-colors hover:bg-muted/25"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <div
              class="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
            >
              <IconTerminal2 class="size-4" />
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-medium">Logs</h3>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">
                Structured runtime events and errors.
              </p>
            </div>
          </div>
          <IconChevronRight
            class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </div>
        <p class="mt-4 text-xl font-semibold tabular-nums">
          {formatNumber(totalLogs)} records
        </p>
      </a>

      <a
        href={`/a/${appId}/traces`}
        class="group rounded-xl border bg-background p-4 transition-colors hover:bg-muted/25"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <div
              class="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
            >
              <IconRoute class="size-4" />
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-medium">Traces</h3>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">
                Request paths, spans, and latency.
              </p>
            </div>
          </div>
          <IconChevronRight
            class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </div>
        <p class="mt-4 text-xl font-semibold tabular-nums">
          {formatNumber(traceSummary?.total ?? 0)} traces
        </p>
      </a>

      <a
        href={`/a/${appId}/alerts`}
        class="group rounded-xl border bg-background p-4 transition-colors hover:bg-muted/25"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <div
              class="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
            >
              <IconBell class="size-4" />
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-medium">Alerts</h3>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">
                Rules watching health signals.
              </p>
            </div>
          </div>
          <IconChevronRight
            class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </div>
        <p class="mt-4 text-xl font-semibold tabular-nums">
          {activeAlerts} active
        </p>
      </a>
    </section>
  </div>
</PageContainer>
