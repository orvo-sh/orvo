<script lang="ts">
  import { cn } from '@repo/components';
  import * as Card from '@repo/components/ui/card';
  import { ChartContainer, ChartTooltip } from '@repo/components/ui/chart';
  import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-svelte';
  import { Area, AreaChart, LinearGradient, Spline } from 'layerchart';

  const uid = $props.id();

  let {
    title,
    data,
    color = 'var(--color-primary)',
    valueFormatter = (v: number) => `${v}`,
    yDomain,
    yFormat,
    summaryValue,
    trend,
    featuredPoint = null
  }: {
    title: string;
    data: { timestamp: Date; value: number }[];
    color?: string;
    valueFormatter?: (value: number) => string;
    yDomain?: [number | null, number | null];
    yFormat?: (value: number) => string;
    summaryValue: number;
    trend: { change: number; reverse?: boolean };
    featuredPoint?: number | 'max' | null;
  } = $props();

  const chartHeight = 190;
  const chartPadding = { top: 10, right: 12, bottom: 4, left: 42 };

  const featuredPointIndex = $derived.by(() => {
    if (featuredPoint === null || data.length === 0) {
      return null;
    }

    if (featuredPoint === 'max') {
      let maxIndex = 0;

      for (let i = 1; i < data.length; i += 1) {
        if (data[i].value > data[maxIndex].value) {
          maxIndex = i;
        }
      }

      return maxIndex;
    }

    return featuredPoint >= 0 && featuredPoint < data.length ? featuredPoint : null;
  });

  const featuredPointData = $derived(
    featuredPointIndex === null ? null : data[featuredPointIndex]
  );

  const featuredPointLabel = $derived.by(() => {
    if (featuredPointData === null) {
      return null;
    }

    return featuredPointData.timestamp.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  });

  const featuredPointPosition = $derived.by(() => {
    if (featuredPointData === null || featuredPointIndex === null || data.length === 0) {
      return null;
    }

    const min = yDomain?.[0] ?? Math.min(...data.map((point) => point.value));
    const max = yDomain?.[1] ?? Math.max(...data.map((point) => point.value));
    const domainRange = max - min || 1;
    const xRatio = data.length === 1 ? 1 : featuredPointIndex / (data.length - 1);
    const yRatio = (featuredPointData.value - min) / domainRange;

    return {
      left: `calc(${chartPadding.left}px + (100% - ${chartPadding.left + chartPadding.right}px) * ${xRatio})`,
      top: `${chartPadding.top + (1 - yRatio) * (chartHeight - chartPadding.top - chartPadding.bottom)}px`
    };
  });
</script>

<Card.Root class="relative overflow-hidden">
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
    <div class="relative h-[190px] w-full px-4 pb-4">
      <ChartContainer
        config={{
          value: {
            label: title,
            color
          }
        }}
        class={cn('h-full w-full', featuredPoint !== null && 'pointer-events-none')}
      >
        <AreaChart
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
          {#snippet marks({ context }: { context: { series: { visibleSeries: { key: string }[] } } })}
            <LinearGradient id={`feature-chart-card-area-${uid}`} vertical={true}>
              {#snippet stopsContent()}
                <stop offset="0%" stop-color={color} stop-opacity="0.44" />
                <stop offset="100%" stop-color={color} stop-opacity="0" />
              {/snippet}
            </LinearGradient>
            {#each context.series.visibleSeries as s (s.key)}
              <Area seriesKey={s.key} fill={`url(#feature-chart-card-area-${uid})`} fillOpacity={1} />
              <Spline seriesKey={s.key} strokeWidth={2} stroke="var(--color-value)" />
            {/each}
          {/snippet}
          {#snippet tooltip()}
            {#snippet tooltipFormatter({ value }: { value: unknown })}
              {valueFormatter(Number(value))}
            {/snippet}
            <ChartTooltip
              class="border-transparent ring-1 ring-foreground/20"
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

      {#if featuredPointData && featuredPointPosition && featuredPointLabel}
        <div
          class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={`left:${featuredPointPosition.left}; top:${featuredPointPosition.top};`}
        >
          <div class="relative">
            <div
              class="border-border/50 bg-background absolute bottom-5 left-1/2 grid min-w-[9rem] -translate-x-1/2 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
            >
              <div class="font-medium">{featuredPointLabel}</div>
              <div class="flex items-center gap-2">
                <div class="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={`background:${color};`}></div>
                <div class="flex flex-1 items-center justify-between gap-4">
                  <span class="text-muted-foreground">{title}</span>
                  <span class="text-foreground font-mono font-medium tabular-nums">
                    {valueFormatter(featuredPointData.value)}
                  </span>
                </div>
              </div>
            </div>
            <span
              class="ring-background block size-3 rounded-full ring-4"
              style={`background:${color};`}
            ></span>
          </div>
        </div>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
