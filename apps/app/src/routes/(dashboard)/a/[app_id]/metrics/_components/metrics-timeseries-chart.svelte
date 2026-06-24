<script lang="ts">
  import { cn } from "@repo/components";
  import * as Card from "@repo/components/ui/card";
  import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
  } from "@repo/components/ui/chart";
  import { Area, AreaChart, LinearGradient, Spline } from "layerchart";
  import { formatMetricValue } from "../format";
  import type { MetricAggregation, MetricSeries } from "../types";

  type ChartRow = {
    timestamp: Date;
    [key: string]: Date | number | null;
  };

  const uid = $props.id();
  const SERIES_COLORS = [
    "var(--color-chart-2)",
    "var(--color-primary)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-muted-foreground)",
    "var(--color-destructive)",
    "var(--color-foreground)",
  ];

  let {
    title = "Metric trend",
    description,
    series,
    aggregation,
    unit = "",
    loading = false,
  }: {
    title?: string;
    description?: string;
    series: MetricSeries[];
    aggregation: MetricAggregation;
    unit?: string;
    loading?: boolean;
  } = $props();

  const displaySeries = $derived(series.slice(0, 8));

  const chartConfig = $derived<ChartConfig>(
    Object.fromEntries(
      displaySeries.map((item, index) => [
        `series${index}`,
        {
          label: item.name,
          color: SERIES_COLORS[index % SERIES_COLORS.length],
        },
      ]),
    ),
  );

  const chartData = $derived.by<ChartRow[]>(() => {
    const firstSeries = displaySeries[0];
    if (!firstSeries) {
      return [];
    }

    return firstSeries.buckets.map((bucket, bucketIndex) => {
      const row: ChartRow = {
        timestamp: new Date(bucket.startAtUtc),
      };

      displaySeries.forEach((item, seriesIndex) => {
        row[`series${seriesIndex}`] = item.buckets[bucketIndex]?.value ?? null;
      });

      return row;
    });
  });

  const hasData = $derived(
    displaySeries.some((item) =>
      item.buckets.some((bucket) => bucket.value !== null && bucket.points > 0),
    ),
  );

  const valueFormatter = (value: number) => {
    if (!Number.isFinite(value)) {
      return "n/a";
    }

    return formatMetricValue(value, unit, aggregation);
  };

  const latestValue = $derived.by(() => {
    const firstSeries = displaySeries[0];
    if (!firstSeries) {
      return null;
    }

    for (let index = firstSeries.buckets.length - 1; index >= 0; index -= 1) {
      const bucket = firstSeries.buckets[index];
      if (bucket.value !== null) {
        return bucket.value;
      }
    }

    return null;
  });

  const timeRangeMs = $derived(
    chartData.length > 1
      ? chartData[chartData.length - 1].timestamp.getTime() -
          chartData[0].timestamp.getTime()
      : 0,
  );

  const yAxisFormatter = (value: number) => valueFormatter(value);
</script>

<Card.Root
  class={cn("relative overflow-hidden", loading && "pointer-events-none")}
>
  <div
    class="pointer-events-none absolute inset-0 z-10 bg-secondary opacity-0 transition-opacity"
    class:opacity-50={loading}
  ></div>

  <Card.Header class="flex items-start justify-between gap-4">
    <div class="space-y-1">
      <Card.Title>{title}</Card.Title>
      {#if description}
        <Card.Description>{description}</Card.Description>
      {/if}
    </div>

    <Card.Action class="pt-1.5">
      <p
        class="text-right text-base leading-none font-semibold tracking-normal tabular-nums"
      >
        {valueFormatter(latestValue ?? 0)}
      </p>
    </Card.Action>
  </Card.Header>

  <Card.Content class="p-0 pt-0">
    <div class="h-[190px] w-full px-4 pb-4">
      {#if hasData}
        <ChartContainer config={chartConfig} class="h-full w-full">
          <AreaChart
            data={chartData}
            x="timestamp"
            padding={{ top: 10, right: 12, bottom: 4, left: 42 }}
            axis={true}
            grid={{ x: false, y: true }}
            tooltipContext={{ mode: "band" }}
            highlight={{ lines: true, points: true }}
            series={displaySeries.map((item, index) => ({
              key: `series${index}`,
              label: item.name,
              value: (row: ChartRow) => row[`series${index}`] as number | null,
              color: `var(--color-series${index})`,
            }))}
            props={{
              yAxis: {
                format: yAxisFormatter,
                tickLabelProps: {
                  style:
                    "font-weight: 600; font-family: var(--font-sans); font-variant-numeric: tabular-nums slashed-zero;",
                  textAnchor: "start",
                  dx: -42,
                },
              },
              xAxis: {
                tickLength: 8,
                tickSpacing: 60,
                format: (() => {
                  const rangeHours = timeRangeMs / (1000 * 60 * 60);

                  if (rangeHours <= 4)
                    return (date: Date) =>
                      date.getMinutes().toString().padStart(2, "0");

                  if (rangeHours <= 48)
                    return (date: Date) =>
                      date.getHours().toString().padStart(2, "0");

                  return (date: Date) =>
                    date.getDate().toString().padStart(2, "0");
                })(),
                tickLabelProps: {
                  style:
                    "font-weight: 600; font-family: var(--font-sans); font-variant-numeric: tabular-nums slashed-zero;",
                  textAnchor: "middle",
                },
              },
            }}
          >
            {#snippet marks({ context })}
              {#each context.series.visibleSeries as s, index (s.key)}
                <LinearGradient
                  id={`metrics-area-${uid}-${s.key}`}
                  vertical={true}
                >
                  {#snippet stopsContent()}
                    <stop
                      offset="0%"
                      stop-color={SERIES_COLORS[index % SERIES_COLORS.length]}
                      stop-opacity={displaySeries.length === 1 ? 0.44 : 0.2}
                    />
                    <stop
                      offset="100%"
                      stop-color={SERIES_COLORS[index % SERIES_COLORS.length]}
                      stop-opacity="0"
                    />
                  {/snippet}
                </LinearGradient>
                <Area
                  seriesKey={s.key}
                  fill={`url(#metrics-area-${uid}-${s.key})`}
                  fillOpacity={1}
                />
                <Spline
                  seriesKey={s.key}
                  strokeWidth={2}
                  stroke={`var(--color-${s.key})`}
                />
              {/each}
            {/snippet}

            {#snippet tooltip()}
              {#snippet tooltipFormatter({ value }: { value: unknown })}
                {valueFormatter(Number(value))}
              {/snippet}
              <ChartTooltip
                class="border-transparent ring-1 ring-foreground/20"
                labelFormatter={(value) =>
                  new Date(value).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                formatter={tooltipFormatter}
              />
            {/snippet}
          </AreaChart>
        </ChartContainer>
      {:else}
        <div class="flex h-full w-full items-center justify-center">
          <p class="text-sm text-muted-foreground">
            No metric points match these filters.
          </p>
        </div>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
