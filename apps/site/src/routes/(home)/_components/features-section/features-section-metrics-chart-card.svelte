<script lang="ts">
  import { cn } from '@repo/components';
  import * as Card from '@repo/components/ui/card';
  import { ChartContainer, ChartTooltip } from '@repo/components/ui/chart';
  import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-svelte';
  import { Area, AreaChart, LinearGradient, Spline, type ChartState } from 'layerchart';

  const uid = $props.id();

  let {
    title,
    data,
    color = 'var(--color-primary)',
    valueFormatter = (v: number) => `${v}`,
    yDomain,
    yFormat,
    summaryValue,
    trend
  }: {
    title: string;
    data: { timestamp: Date; value: number }[];
    color?: string;
    valueFormatter?: (value: number) => string;
    yDomain?: [number | null, number | null];
    yFormat?: (value: number) => string;
    summaryValue: number;
    trend: { change: number; reverse?: boolean };
  } = $props();

  let chartContext = $state<ChartState<{ timestamp: Date; value: number }>>();
  let retainedData = $state<{ timestamp: Date; value: number } | null>(data.at(-1) ?? null);
  let retainedX = $state(0);
  let retainedY = $state(0);
  let retainedSeries = $state<
    ChartState<{ timestamp: Date; value: number }>['tooltip']['series']
  >([]);

  $effect(() => {
    const context = chartContext;
    const tooltip = context?.tooltipState;

    if (!context || !tooltip || !retainedData) {
      return;
    }

    if (tooltip.isHoveringTooltipArea && tooltip.data) {
      retainedData = tooltip.data;
      retainedX = tooltip.x;
      retainedY = tooltip.y;
      retainedSeries = tooltip.series;
      return;
    }

    if (!tooltip.data) {
      const series = context.series.visibleSeries[0];

      tooltip.data = retainedData;
      tooltip.x = retainedX || Number(context.xScale(context.x(retainedData))) + context.padding.left;
      tooltip.y = retainedY || Number(context.yScale(context.y(retainedData))) + context.padding.top;
      tooltip.series =
        retainedSeries.length > 0 || !series
          ? retainedSeries
          : [
              {
                key: series.key,
                label: series.label ?? title,
                value: retainedData.value,
                color: series.color,
                visible: true,
                config: series
              }
            ];
    }
  });
</script>

<Card.Root class="relative overflow-hidden shadow-xs">
  <Card.Header class="flex items-start justify-between">
    <Card.Title>{title}</Card.Title>

    <Card.Action class="flex flex-col gap-1 pt-1.5">
      <p class="text-right text-base leading-none font-semibold tracking-normal tabular-nums">
        {valueFormatter(summaryValue ?? data[data.length - 1]?.value ?? 0)}
      </p>
      <div class="flex items-end gap-0.5">
        <span
          class={cn(
            'inline-flex items-center gap-1 text-xs font-normal tabular-nums',
            trend.change === 0
              ? 'text-muted-foreground'
              : (trend.reverse ? trend.change < 0 : trend.change > 0)
                ? 'text-green-600'
                : 'text-red-600'
          )}
        >
          {#if trend.change > 0}
            <IconTrendingUp class="size-3" />
          {:else if trend.change < 0}
            <IconTrendingDown class="size-3" />
          {/if}
          {trend.change >= 0 ? '' : '-'}{Math.abs(trend.change).toFixed(1)}%
          <span class="text-muted-foreground">vs last period</span>
        </span>
      </div>
    </Card.Action>
  </Card.Header>
  <Card.Content class="p-0 pt-0">
    <div class="relative h-[190px] w-full px-3 pb-3">
      <ChartContainer
        config={{
          value: {
            label: title,
            color
          }
        }}
        class="h-full w-full"
      >
        <AreaChart
          bind:context={chartContext}
          {data}
          x="timestamp"
          y="value"
          {yDomain}
          padding={{ top: 10, right: 12, bottom: 4, left: 42 }}
          axis={true}
          grid={{ x: false, y: true }}
          tooltipContext={{ mode: 'band' }}
          highlight={{ lines: true, points: true }}
          series={[
            {
              key: 'value',
              label: title,
              value: (row: { timestamp: Date; value: number }) => row.value,
              color: 'var(--color-value)'
            }
          ]}
          props={{
            yAxis: {
              format: yFormat,
              tickLabelProps: {
                style:
                  'font-weight: 600; font-family: var(--font-sans); font-variant-numeric: tabular-nums slashed-zero;',
                textAnchor: 'start',
                dx: -42
              }
            },
            xAxis: {
              tickLength: 8,
              tickSpacing: 60,
              format: (() => {
                const rangeHours =
                  data.length > 1
                    ? (data[data.length - 1].timestamp.getTime() - data[0].timestamp.getTime()) /
                      (1000 * 60 * 60)
                    : 0;

                if (rangeHours <= 4) {
                  return (d: Date) => d.getMinutes().toString().padStart(2, '0');
                }

                if (rangeHours <= 48) {
                  return (d: Date) => d.getHours().toString().padStart(2, '0');
                }

                return (d: Date) => d.getDate().toString().padStart(2, '0');
              })(),
              tickLabelProps: {
                style:
                  'font-weight: 600; font-family: var(--font-sans); font-variant-numeric: tabular-nums slashed-zero;',
                textAnchor: 'middle'
              }
            }
          }}
        >
          {#snippet marks({
            context
          }: {
            context: { series: { visibleSeries: { key: string }[] } };
          })}
            <LinearGradient id={`feature-chart-card-area-${uid}`} vertical={true}>
              {#snippet stopsContent()}
                <stop offset="0%" stop-color={color} stop-opacity="0.44" />
                <stop offset="100%" stop-color={color} stop-opacity="0" />
              {/snippet}
            </LinearGradient>
            {#each context.series.visibleSeries as s (s.key)}
              <Area
                seriesKey={s.key}
                fill={`url(#feature-chart-card-area-${uid})`}
                fillOpacity={1}
              />
              <Spline seriesKey={s.key} strokeWidth={2} stroke="var(--color-value)" />
            {/each}
          {/snippet}
          {#snippet tooltip()}
            {#snippet tooltipFormatter({ value }: { value: unknown })}
              {valueFormatter(Number(value))}
            {/snippet}
            <ChartTooltip
              class="ring-foreground/20 border-transparent ring-1"
              labelFormatter={(value) =>
                new Date(value).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              formatter={tooltipFormatter}
            />
          {/snippet}
        </AreaChart>
      </ChartContainer>

    </div>
  </Card.Content>
</Card.Root>
