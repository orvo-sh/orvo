<script lang="ts">
  import { cn } from "@repo/components";
  import * as Card from "@repo/components/ui/card";
  import { ChartContainer, ChartTooltip } from "@repo/components/ui/chart";
  import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-svelte";
  import { Area, AreaChart, LinearGradient, Spline } from "layerchart";

  const uid = $props.id();

  let {
    title,
    data,
    color = "var(--color-primary)",
    valueFormatter = (v: number) => `${v}`,
    yDomain,
    yFormat,
    loading,
    summaryValue,
    trend,
  }: {
    title: string;
    data: { timestamp: Date; value: number }[];
    color?: string;
    valueFormatter?: (value: number) => string;
    yDomain?: [number | null, number | null];
    yFormat?: (value: number) => string;
    loading: boolean;

    summaryValue: number;
    trend: { change: number; reverse?: boolean };
  } = $props();
</script>

<Card.Root
  class={cn("relative overflow-hidden", loading && "pointer-events-none")}
>
  <div
    class="absolute top-0 h-full w-full bg-secondary opacity-0 transition-opacity"
    class:opacity-50={loading}
    class:z-99={loading}
  ></div>
  <Card.Header class="flex items-start justify-between">
    <Card.Title>{title}</Card.Title>

    <Card.Action class="flex flex-col gap-1 pt-1.5">
      <p
        class="text-right text-base leading-none font-semibold tracking-normal tabular-nums"
      >
        {valueFormatter(summaryValue ?? data[data.length - 1]?.value ?? 0)}
      </p>
      <div class="flex items-end gap-0.5">
        <span
          class={cn(
            "inline-flex items-center gap-1 text-xs font-normal tabular-nums",
            trend.change === 0
              ? "text-muted-foreground"
              : (trend.reverse ? trend.change < 0 : trend.change > 0)
                ? "text-green-600"
                : "text-red-600",
          )}
        >
          {#if trend.change > 0}
            <IconTrendingUp class="size-3" />
          {:else if trend.change < 0}
            <IconTrendingDown class="size-3" />
          {/if}
          {trend.change >= 0 ? "" : "-"}{Math.abs(trend.change).toFixed(1)}%
          <span class="text-muted-foreground">vs last period</span>
        </span>
      </div>
    </Card.Action>
  </Card.Header>
  <Card.Content class="p-0 pt-0">
    <div class="h-[190px] w-full px-4 pb-4">
      <ChartContainer
        config={{
          value: {
            label: title,
            color,
          },
        }}
        class="h-full w-full"
      >
        <AreaChart
          {data}
          x="timestamp"
          y="value"
          {yDomain}
          padding={{ top: 10, right: 12, bottom: 4, left: 42 }}
          axis={true}
          grid={{ x: false, y: true }}
          tooltipContext={{ mode: "band" }}
          highlight={{ lines: true, points: true }}
          series={[
            {
              key: "value",
              label: title,
              value: (row: { timestamp: Date; value: number }) => row.value,
              color: "var(--color-value)",
            },
          ]}
          props={{
            yAxis: {
              format: yFormat,
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
                const rangeHours =
                  data.length > 1
                    ? (data[data.length - 1].timestamp.getTime() -
                        data[0].timestamp.getTime()) /
                      (1000 * 60 * 60)
                    : 0;

                if (rangeHours <= 4)
                  return (d: Date) =>
                    d.getMinutes().toString().padStart(2, "0");

                if (rangeHours <= 48)
                  return (d: Date) => d.getHours().toString().padStart(2, "0");

                return (d: Date) => d.getDate().toString().padStart(2, "0");
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
            <LinearGradient id={`chart-card-area-${uid}`} vertical={true}>
              {#snippet stopsContent()}
                <stop offset="0%" stop-color={color} stop-opacity="0.44" />
                <stop offset="100%" stop-color={color} stop-opacity="0" />
              {/snippet}
            </LinearGradient>
            {#each context.series.visibleSeries as s (s.key)}
              <Area
                seriesKey={s.key}
                fill={`url(#chart-card-area-${uid})`}
                fillOpacity={1}
              />
              <Spline
                seriesKey={s.key}
                strokeWidth={2}
                stroke="var(--color-value)"
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
    </div>
  </Card.Content>
</Card.Root>
