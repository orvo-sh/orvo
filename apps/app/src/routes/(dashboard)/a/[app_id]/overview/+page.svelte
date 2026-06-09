<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import {
    IconBell,
    IconChevronRight,
    IconDots,
    IconRoute,
    IconSearch,
    IconTerminal2,
    IconX,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  import PageContainer from "../../../_components/page-container/page-container.svelte";
  import AppHealthCard from "./_components/app-health-card.svelte";

  type ServiceRow = {
    name: string;
    logs: number;
    logErrors: number;
    traces: number;
    traceErrors: number;
    errorRate: number;
    p95LatencyMs: number;
    volumeBuckets: Array<{ startAtUtc: string; total: number; errors: number }>;
  };

  type PageData = {
    appName: string;
    timePreset: string;
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
    services: ServiceRow[];
    insights: Array<{
      id: string;
      title: string;
      body: string;
      severity: "critical" | "warning" | "info";
      category: string;
      score: number;
      serviceName?: string;
      link?: string;
    }>;
  };

  const timeOptions = [
    { label: "30m", preset: "last_30_minutes" },
    { label: "1h", preset: "last_hour" },
    { label: "4h", preset: "last_4_hours" },
    { label: "24h", preset: "last_24_hours" },
    { label: "7d", preset: "last_7_days" },
  ];

  const data = $derived(page.data as PageData);
  const appName = $derived(data.appName);
  const timePreset = $derived(data.timePreset ?? "last_hour");
  const logVolume = $derived(data.logVolume);
  const traceSummary = $derived(data.traceSummary);
  const alertRules = $derived(data.alerts?.rules ?? []);
  const deployments = $derived(data.deployments?.deployments ?? []);
  const services = $derived(data.services ?? []);
  const insights = $derived(data.insights ?? []);

  let serviceSearch = $state("");
  let openMenu = $state<string | null>(null);
  let menuRef = $state<HTMLElement | null>(null);

  const filteredServices = $derived(
    serviceSearch.length > 0
      ? services.filter((s) =>
          s.name.toLowerCase().includes(serviceSearch.toLowerCase()),
        )
      : services,
  );

  const totalLogs = $derived(
    logVolume?.buckets.reduce((sum, b) => sum + b.total, 0) ?? 0,
  );
  const activeAlerts = $derived(
    alertRules.filter((r) => r.openIncident != null).length,
  );

  const appId = $derived(page.params.app_id);

  function formatNumber(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toString();
  }

  function logFilterUrl(serviceName: string) {
    return `/a/${appId}/logs?services=${encodeURIComponent(serviceName)}`;
  }

  function setTimePreset(preset: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("t", preset);
    window.history.pushState({}, "", url.toString());
    window.location.reload();
  }

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenu && menuRef && !menuRef.contains(e.target as Node)) {
        openMenu = null;
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });
</script>

<PageContainer title="Overview" class="bg-secondary">
  <div class="mx-auto flex w-full flex-col gap-5">
    <AppHealthCard
      {timePreset}
      {timeOptions}
      {logVolume}
      {traceSummary}
      {alertRules}
      {deployments}
      {insights}
      onTimePresetChange={setTimePreset}
    />

    {#if services.length > 0}
      <section class="space-y-3">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <h2 class="text-lg font-semibold tracking-tight">Services</h2>
          <div class="flex items-center gap-2">
            <div class="relative">
              <IconSearch
                class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="text"
                placeholder="Search services..."
                bind:value={serviceSearch}
                class="h-8 w-48 rounded-lg pl-8 text-sm"
              />
              {#if serviceSearch.length > 0}
                <button
                  class="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onclick={() => (serviceSearch = "")}
                >
                  <IconX class="size-3.5" />
                </button>
              {/if}
            </div>
            <Button href={`/a/${appId}/logs`} variant="outline" size="sm">
              <IconTerminal2 data-slot="button-icon" />
              View logs
            </Button>
          </div>
        </div>

        {#if filteredServices.length === 0}
          <div
            class="flex items-center justify-center rounded-xl border bg-background py-12"
          >
            <p class="text-sm text-muted-foreground">
              No services match "{serviceSearch}".
            </p>
          </div>
        {:else}
          <div class="overflow-hidden rounded-xl border bg-background">
            <div
              class="hidden grid-cols-[minmax(180px,1.2fr)_1fr_1fr_1fr_1fr_140px_40px] items-center gap-4 border-b border-border/70 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid"
            >
              <span>Service</span>
              <span>Volume</span>
              <span>Error rate</span>
              <span>P95 latency</span>
              <span>Trend</span>
              <span>Last seen</span>
              <span></span>
            </div>

            <div class="divide-y divide-border/70">
              {#each filteredServices as service (service.name)}
                {@const svcErrorColor =
                  service.errorRate > 0.05
                    ? "text-red-600 dark:text-red-400"
                    : service.errorRate > 0.01
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-green-600 dark:text-green-400"}
                {@const svcDotColor =
                  service.errorRate > 0.05
                    ? "bg-red-500"
                    : service.errorRate > 0.01
                      ? "bg-amber-500"
                      : "bg-green-500"}
                {@const maxSvcVol = Math.max(
                  ...service.volumeBuckets.map((b) => b.total),
                  1,
                )}
                {@const linePath = service.volumeBuckets
                  .map(
                    (b, i) =>
                      `${(i / Math.max(service.volumeBuckets.length - 1, 1)) * 100} ${100 - (b.total / maxSvcVol) * 90}`,
                  )
                  .join(" ")}
                {@const errorLinePath = service.volumeBuckets
                  .map(
                    (b, i) =>
                      `${(i / Math.max(service.volumeBuckets.length - 1, 1)) * 100} ${100 - (b.errors / maxSvcVol) * 90}`,
                  )
                  .join(" ")}
                <div
                  class="grid gap-2 px-4 py-3 md:grid-cols-[minmax(180px,1.2fr)_1fr_1fr_1fr_1fr_140px_40px] md:items-center md:gap-4"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <span class="size-2 shrink-0 rounded-full {svcDotColor}"
                    ></span>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium">
                        {service.name}
                      </p>
                      <p class="text-xs text-muted-foreground md:hidden">
                        {formatNumber(service.logs + service.traces)} requests ·
                        {service.errorRate > 0
                          ? `${(service.errorRate * 100).toFixed(1)}% errors`
                          : "0% errors"}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-4">
                    <div class="hidden min-w-0 flex-1 md:block">
                      <svg
                        class="h-8 w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <polyline
                          points={linePath}
                          fill="none"
                          stroke="hsl(var(--primary) / 0.6)"
                          stroke-width="2"
                          vector-effect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                    <div class="text-sm tabular-nums">
                      {formatNumber(service.logs + service.traces)}
                    </div>
                  </div>

                  <p class="text-sm tabular-nums {svcErrorColor}">
                    {(service.errorRate * 100).toFixed(1)}%
                  </p>

                  <p class="text-sm text-muted-foreground tabular-nums">
                    {service.p95LatencyMs > 0
                      ? `${Math.round(service.p95LatencyMs)}ms`
                      : "—"}
                  </p>

                  <div class="hidden md:block">
                    <svg
                      class="h-6 w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polyline
                        points={linePath}
                        fill="none"
                        stroke={service.errorRate > 0.05
                          ? "hsl(var(--red) / 0.6)"
                          : service.errorRate > 0.01
                            ? "hsl(var(--amber) / 0.5)"
                            : "hsl(var(--primary) / 0.4)"}
                        stroke-width="2"
                        vector-effect="non-scaling-stroke"
                      />
                      {#if service.volumeBuckets.some((b) => b.errors > 0)}
                        <polyline
                          points={errorLinePath}
                          fill="none"
                          stroke="hsl(var(--red) / 0.5)"
                          stroke-width="1.5"
                          vector-effect="non-scaling-stroke"
                          stroke-dasharray="2 2"
                        />
                      {/if}
                    </svg>
                  </div>

                  <p class="hidden text-sm text-muted-foreground md:block">—</p>

                  <div class="relative hidden justify-end md:flex">
                    <button
                      class="rounded-md p-1 transition-colors hover:bg-muted"
                      onclick={(e) => {
                        e.stopPropagation();
                        openMenu =
                          openMenu === service.name ? null : service.name;
                      }}
                      aria-label={`Open ${service.name} actions`}
                    >
                      <IconDots class="size-4 text-muted-foreground" />
                    </button>

                    {#if openMenu === service.name}
                      <div
                        class="absolute top-full right-0 z-50 mt-1 w-40 rounded-lg border bg-popover p-1 shadow-md"
                        bind:this={menuRef}
                      >
                        <a
                          href={logFilterUrl(service.name)}
                          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                          onmousedown={() => (openMenu = null)}
                        >
                          <IconTerminal2
                            class="size-3.5 text-muted-foreground"
                          />
                          View logs
                        </a>
                        <a
                          href={`/a/${appId}/traces?services=${encodeURIComponent(service.name)}`}
                          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                          onmousedown={() => (openMenu = null)}
                        >
                          <IconRoute class="size-3.5 text-muted-foreground" />
                          View traces
                        </a>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {/if}

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
