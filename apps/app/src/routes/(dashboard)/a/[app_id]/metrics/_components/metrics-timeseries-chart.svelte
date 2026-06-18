<script lang="ts">
  import * as Card from "@repo/components/ui/card";
  import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
  } from "@repo/components/ui/chart";
  import { formatNumber } from "@repo/utils";
  import { AreaChart } from "layerchart";
  import type { MetricAggregation, MetricSeries } from "../types";

  type ChartRow = {
    timestamp: Date;
    [key: string]: Date | number | null;
  };

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
      return "0";
    }

    const formatted =
      Math.abs(value) >= 1000
        ? formatNumber(value)
        : Number.isInteger(value)
          ? value.toString()
          : value.toFixed(Math.abs(value) < 10 ? 2 : 1);

    return unit && aggregation !== "count" ? `${formatted} ${unit}` : formatted;
  };

  const timeRangeMs = $derived(
    chartData.length > 1
      ? chartData[chartData.length - 1].timestamp.getTime() -
          chartData[0].timestamp.getTime()
      : 0,
  );
</script>

<Card.Root class="min-h-[420px] overflow-hidden">
  <Card.Header class="flex-row items-start justify-between gap-4 pb-3">
    <div class="space-y-1">
      <Card.Title class="text-sm font-medium">{title}</Card.Title>
      <Card.Description>
        {description ??
          `${
            aggregation === "avg"
              ? "Average value"
              : aggregation === "sum"
                ? "Summed value"
                : aggregation === "count"
                  ? "Point count"
                  : `${aggregation} value`
          } over the selected range`}
      </Card.Description>
    </div>
    {#if loading}
      <div class="mt-1 h-2 w-2 rounded-full bg-primary"></div>
    {/if}
  </Card.Header>
  <Card.Content class="p-0">
    <div class="h-[320px] w-full px-4 pb-4">
      {#if hasData}
        <ChartContainer config={chartConfig} class="h-full w-full">
          <AreaChart
            data={chartData}
            x="timestamp"
            yDomain={[0, null]}
            padding={{ top: 8, right: 3, bottom: 3, left: 3 }}
            axis="x"
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
              area: {
                fillOpacity: displaySeries.length === 1 ? 0.16 : 0.06,
              },
              spline: {
                strokeWidth: 2,
              },
              xAxis: {
                tickLength: 8,
                tickSpacing: 64,
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
            {#snippet tooltip()}
              {#snippet tooltipFormatter({ value }: { value: unknown })}
                {valueFormatter(Number(value))}
              {/snippet}
              <ChartTooltip
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

    {#if displaySeries.length > 0}
      <div class="flex flex-wrap gap-2 border-t px-4 py-3">
        {#each displaySeries as item, index}
          <div
            class="inline-flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span
              class="h-2 w-2 rounded-full"
              style={`background: ${SERIES_COLORS[index % SERIES_COLORS.length]}`}
            ></span>
            <span class="max-w-48 truncate text-foreground">{item.name}</span>
            <span>{formatNumber(item.points)} pts</span>
          </div>
        {/each}
      </div>
    {/if}
  </Card.Content>
</Card.Root>
