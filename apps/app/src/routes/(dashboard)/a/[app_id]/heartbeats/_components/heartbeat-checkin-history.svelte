<script lang="ts">
  import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
  } from "@repo/components/ui/chart";
  import { AreaChart } from "layerchart";

  let {
    history,
    expectedEverySeconds,
  }: {
    history: {
      rangeStartAt: Date | string;
      rangeEndAt: Date | string;
      bucketSizeSeconds: number;
      buckets: Array<{
        startAt: Date | string;
        endAt: Date | string;
        count: number;
        status: "healthy" | "missed" | "grace";
      }>;
      recentCheckIns: Array<{
        checkedInAt: Date | string;
      }>;
      stats: {
        totalCheckIns24h: number;
        receivedBuckets24h: number;
        missedBuckets24h: number;
        averageIntervalSeconds: number | null;
      };
    };
    expectedEverySeconds: number;
  } = $props();

  const chartConfig = {
    total: {
      label: "Check-ins",
      color: "var(--color-primary)",
    },
  } satisfies ChartConfig;

  const chartData = $derived(
    history.buckets.map((bucket) => ({
      timestamp: new Date(bucket.startAt),
      total: bucket.count,
    })),
  );

  const hasData = $derived(history.buckets.some((bucket) => bucket.count > 0));

  const formatBucketLabel = (value: Date | string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  const formatInterval = (seconds: number | null) => {
    if (!seconds) {
      return "Waiting";
    }

    if (seconds < 60) {
      return `${seconds}s`;
    }

    if (seconds % 60 === 0) {
      return `${seconds / 60}m`;
    }

    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const statusClass = (status: "healthy" | "missed" | "grace") => {
    switch (status) {
      case "healthy":
        return "bg-primary/80";
      case "missed":
        return "bg-destructive/80";
      case "grace":
        return "bg-muted";
    }
  };

  const formatTimeAgo = (value: Date | string) => {
    const seconds = Math.max(
      Math.floor((Date.now() - new Date(value).getTime()) / 1000),
      0,
    );

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
</script>

<section class="rounded-xl border bg-background">
  <div class="border-b border-border/70 px-4 py-3">
    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 class="text-sm font-medium">Check-in history</h3>
        <p class="text-sm text-muted-foreground">
          Last 24 hours, grouped into {formatInterval(history.bucketSizeSeconds)} buckets.
        </p>
      </div>
      <p class="text-xs text-muted-foreground">
        Expected every {formatInterval(expectedEverySeconds)}
      </p>
    </div>
  </div>

  <div class="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
    <div class="space-y-4">
      <div class="h-[260px] w-full">
        {#if hasData}
          <ChartContainer config={chartConfig} class="h-full w-full">
            <AreaChart
              data={chartData}
              x="timestamp"
              yDomain={[0, null]}
              padding={{ top: 8, right: 4, bottom: 4, left: 4 }}
              axis="x"
              grid={{ x: false, y: true }}
              tooltipContext={{ mode: "band" }}
              highlight={{ lines: true, points: true }}
              series={[
                {
                  key: "total",
                  label: "Check-ins",
                  value: (row: { total: number }) => row.total,
                  color: "var(--color-total)",
                },
              ]}
              props={{
                area: {
                  fillOpacity: 0.18,
                },
                spline: {
                  strokeWidth: 2,
                },
                xAxis: {
                  tickLength: 8,
                  tickSpacing: 64,
                  format: (value: Date) =>
                    value.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
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
                  {Number(value)} check-in{Number(value) === 1 ? "" : "s"}
                {/snippet}
                <ChartTooltip
                  labelFormatter={(value) => formatBucketLabel(value)}
                  formatter={tooltipFormatter}
                />
              {/snippet}
            </AreaChart>
          </ChartContainer>
        {:else}
          <div class="flex h-full items-center justify-center rounded-lg border border-dashed">
            <p class="text-sm text-muted-foreground">
              No heartbeat check-ins have been recorded yet.
            </p>
          </div>
        {/if}
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">
            Bucket coverage
          </p>
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-primary/80"></span>
              Received
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-destructive/80"></span>
              Missed
            </span>
          </div>
        </div>
        <div class="grid grid-cols-12 gap-1 sm:grid-cols-16 lg:grid-cols-12 xl:grid-cols-16">
          {#each history.buckets as bucket}
            <div
              class={`h-3 rounded-sm ${statusClass(bucket.status)}`}
              title={`${formatBucketLabel(bucket.startAt)} · ${bucket.count} check-in${bucket.count === 1 ? "" : "s"}`}
            ></div>
          {/each}
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div class="rounded-lg border bg-muted/20 px-3 py-3">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">
            Check-ins in 24h
          </p>
          <p class="mt-1 text-2xl font-semibold">
            {history.stats.totalCheckIns24h}
          </p>
        </div>
        <div class="rounded-lg border bg-muted/20 px-3 py-3">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">
            Missed buckets
          </p>
          <p class="mt-1 text-2xl font-semibold">
            {history.stats.missedBuckets24h}
          </p>
        </div>
        <div class="rounded-lg border bg-muted/20 px-3 py-3">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">
            Buckets with activity
          </p>
          <p class="mt-1 text-2xl font-semibold">
            {history.stats.receivedBuckets24h}
          </p>
        </div>
        <div class="rounded-lg border bg-muted/20 px-3 py-3">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">
            Average interval
          </p>
          <p class="mt-1 text-2xl font-semibold">
            {formatInterval(history.stats.averageIntervalSeconds)}
          </p>
        </div>
      </div>

      <div class="rounded-lg border">
        <div class="border-b border-border/70 px-3 py-2">
          <p class="text-sm font-medium">Recent check-ins</p>
        </div>
        <div class="max-h-[260px] space-y-0.5 overflow-y-auto px-3 py-2">
          {#if history.recentCheckIns.length === 0}
            <p class="py-4 text-sm text-muted-foreground">
              No check-ins recorded yet.
            </p>
          {:else}
            {#each history.recentCheckIns as item}
              <div class="flex items-center justify-between gap-3 py-1.5">
                <p class="text-sm font-medium">
                  {formatTimeAgo(item.checkedInAt)}
                </p>
                <p class="text-xs text-muted-foreground">
                  {formatBucketLabel(item.checkedInAt)}
                </p>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</section>
