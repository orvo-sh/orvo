<script lang="ts">
  import { getDashboardPanelDataQuery } from "$lib/api/dashboards.remote";
  import type { DashboardPanel } from "$lib/dashboards/schema";
  import { dashboardTimeRanges } from "$lib/dashboards/schema";
  import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
  } from "@repo/components/ui/chart";
  import { Button } from "@repo/components/ui/button";
  import { Spinner } from "@repo/components/ui/spinner";
  import * as Table from "@repo/components/ui/table";
  import { AreaChart, Spline } from "layerchart";
  let {
    panel,
    timeRange,
    refresh = 0,
  }: {
    panel: DashboardPanel;
    timeRange: (typeof dashboardTimeRanges)[number];
    refresh?: number;
  } = $props();
  let result = $state<Awaited<
    ReturnType<typeof getDashboardPanelDataQuery>
  > | null>(null);
  let loading = $state(true);
  let failed = $state(false);
  let retry = $state(0);
  const configKey = $derived(
    JSON.stringify({
      source: panel.source,
      measure: panel.measure,
      aggregation: panel.aggregation,
      metricName: panel.metricName,
      service: panel.service,
      environment: panel.environment,
      groupBy: panel.groupBy,
      model: panel.model,
      provider: panel.provider,
      unit: panel.unit,
      visualization: panel.visualization,
    }),
  );
  $effect(() => {
    const config = JSON.parse(configKey);
    const time = timeRange;
    void refresh;
    void retry;
    if (
      config.visualization === "text" ||
      (config.source === "metrics" && !config.metricName)
    ) {
      result = null;
      loading = false;
      return;
    }
    let active = true;
    loading = true;
    const timer = setTimeout(async () => {
      try {
        const query = getDashboardPanelDataQuery({
          panel: {
            ...config,
            id: "query",
            title: "Panel",
            x: 0,
            y: 0,
            w: 12,
            h: 6,
            text: "",
          },
          timeRange: time,
        });
        const next = await query.run();
        if (active) {
          result = next;
          failed = false;
        }
      } catch {
        if (active) {
          failed = true;
          result = null;
        }
      } finally {
        if (active) loading = false;
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  });
  const colors = [
    "var(--color-primary)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-destructive)",
  ];
  const data = $derived(result?.success ? result.data : null);
  const chartConfig = $derived<ChartConfig>(
    Object.fromEntries(
      (data?.series ?? []).map((series, index) => [
        `series${index}`,
        { label: series.name, color: colors[index % colors.length] },
      ]),
    ),
  );
  const chartData = $derived(
    (data?.series[0]?.buckets ?? []).map((bucket, index) => ({
      timestamp: new Date(bucket.time),
      ...Object.fromEntries(
        (data?.series ?? []).map((series, i) => [
          `series${i}`,
          series.buckets[index]?.value ?? null,
        ]),
      ),
    })),
  );
  const formatValue = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return "—";
    const unit = data?.unit ?? "";
    if (unit === "bytes") {
      const index = Math.min(
        4,
        Math.floor(Math.log(Math.max(1, Math.abs(value))) / Math.log(1024)),
      );
      return `${(value / 1024 ** index).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${["B", "KB", "MB", "GB", "TB"][index]}`;
    }
    return `${value.toLocaleString(undefined, { maximumFractionDigits: unit === "%" ? 2 : 1, notation: Math.abs(value) >= 10000 ? "compact" : "standard" })}${unit ? ` ${unit}` : ""}`;
  };
</script>

<div class="relative flex h-full min-h-0 flex-col" aria-busy={loading}>
  {#if panel.visualization === "text"}
    <div
      class="overflow-auto px-4 pb-4 text-sm leading-6 whitespace-pre-wrap text-muted-foreground"
    >
      {panel.text || "Add a note in panel settings."}
    </div>
  {:else if panel.source === "metrics" && !panel.metricName}
    <div
      class="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground"
    >
      Choose a metric in panel settings.
    </div>
  {:else if loading && !data}
    <div class="flex flex-1 items-center justify-center">
      <Spinner class="size-4 text-muted-foreground" /><span class="sr-only"
        >Loading panel</span
      >
    </div>
  {:else if failed || (result && !result.success)}
    <div
      class="flex flex-1 flex-col items-center justify-center gap-2 px-3 text-center text-sm text-muted-foreground"
    >
      <p>
        {result && !result.success
          ? result.error
          : "Failed to load panel data."}
      </p>
      <Button size="sm" variant="outline" onclick={() => retry++}>Retry</Button>
    </div>
  {:else if !data || (!data.logs.length && !data.series.some( (series) => series.buckets.some((bucket) => bucket.value !== null), ))}
    <div
      class="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground"
    >
      No data for this time range.
    </div>
  {:else if panel.visualization === "stat"}
    <div
      class="flex min-h-0 flex-1 flex-wrap items-center gap-5 overflow-auto px-4 pb-4"
    >
      {#each data.series as series (series.name)}<div>
          <p class="text-3xl font-semibold tracking-tight tabular-nums">
            {formatValue(series.value)}
          </p>
          {#if data.series.length > 1}<p
              class="mt-1 text-sm text-muted-foreground"
            >
              {series.name}
            </p>{/if}
        </div>{/each}
    </div>
  {:else if panel.visualization === "logs"}
    <div class="min-h-0 overflow-auto">
      <Table.Root
        ><Table.Header
          ><Table.Row
            ><Table.Head>Time</Table.Head><Table.Head>Service</Table.Head
            ><Table.Head>Message</Table.Head></Table.Row
          ></Table.Header
        ><Table.Body
          >{#each data.logs as log, index (`${log.time}-${index}`)}<Table.Row
              ><Table.Cell
                class="text-xs whitespace-nowrap text-muted-foreground"
                >{new Date(log.time).toLocaleTimeString()}</Table.Cell
              ><Table.Cell class="text-xs">{log.service || "—"}</Table.Cell
              ><Table.Cell class="max-w-96 truncate text-xs" title={log.message}
                >{log.message}</Table.Cell
              ></Table.Row
            >{/each}</Table.Body
        ></Table.Root
      >
    </div>
  {:else if panel.visualization === "table"}
    <div class="min-h-0 overflow-auto">
      <Table.Root
        ><Table.Header
          ><Table.Row
            ><Table.Head>Series</Table.Head><Table.Head class="text-right"
              >Value</Table.Head
            ></Table.Row
          ></Table.Header
        ><Table.Body
          >{#each data.series as series (series.name)}<Table.Row
              ><Table.Cell>{series.name}</Table.Cell><Table.Cell
                class="text-right tabular-nums"
                >{formatValue(series.value)}</Table.Cell
              ></Table.Row
            >{/each}</Table.Body
        ></Table.Root
      >
    </div>
  {:else if panel.visualization === "bar"}
    <div class="space-y-3 overflow-auto px-4 pb-4">
      {#each data.series as series, index (series.name)}<div
          class="space-y-1.5"
        >
          <div class="flex justify-between gap-3 text-sm">
            <span class="truncate">{series.name}</span><span
              class="shrink-0 tabular-nums">{formatValue(series.value)}</span
            >
          </div>
          <div class="h-2 overflow-hidden rounded-sm bg-muted">
            <div
              class="h-full rounded-sm"
              style:background={colors[index % colors.length]}
              style:width={`${Math.min(100, (Math.abs(series.value ?? 0) / Math.max(1, ...data.series.map((s) => Math.abs(s.value ?? 0)))) * 100)}%`}
            ></div>
          </div>
        </div>{/each}
    </div>
  {:else}
    <div class="min-h-0 flex-1 px-2 pb-1">
      <ChartContainer config={chartConfig} class="h-full w-full">
        <AreaChart
          data={chartData}
          x="timestamp"
          padding={{ top: 8, right: 12, bottom: 20, left: 48 }}
          axis={true}
          grid={{ x: false, y: true }}
          tooltipContext={{ mode: "band" }}
          highlight={{ lines: true, points: true }}
          series={data.series.map((series, index) => ({
            key: `series${index}`,
            label: series.name,
            value: (row: Record<string, unknown>) =>
              row[`series${index}`] as number | null,
            color: colors[index % colors.length],
          }))}
          props={{
            yAxis: {
              format: (value: number) => formatValue(value),
              tickSpacing: 48,
            },
            xAxis: {
              tickSpacing: 90,
              format: (date: Date) =>
                date.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            },
          }}
        >
          {#snippet marks({
            context,
          })}{#each context.series.visibleSeries as s, index (s.key)}<Spline
                seriesKey={s.key}
                strokeWidth={2}
                stroke={colors[index % colors.length]}
              />{/each}{/snippet}
          {#snippet tooltip()}<ChartTooltip
              labelFormatter={(value) => new Date(value).toLocaleString()}
            />{/snippet}
        </AreaChart>
      </ChartContainer>
    </div>
    {#if data.series.length > 1}<div
        class="flex shrink-0 flex-wrap gap-x-3 gap-y-1 px-4 pb-3 text-xs text-muted-foreground"
      >
        {#each data.series as series, index (series.name)}<span
            class="inline-flex items-center gap-1.5"
            ><span
              class="size-1.5 rounded-full"
              style:background={colors[index % colors.length]}
            ></span>{series.name}</span
          >{/each}
      </div>{/if}
  {/if}
  {#if loading && data}<div class="absolute top-0 right-3">
      <Spinner class="size-3 text-muted-foreground" />
    </div>{/if}
</div>
