<script lang="ts">
  import * as HoverCard from "@repo/components/ui/hover-card";
  import type { LogVolumeBucket } from "../types";

  const CHART_HEIGHT = 30;
  const LABEL_HEIGHT = 16;
  const MIN_BAR_HEIGHT = 2;
  const MIN_TIME_LABEL_COUNT = 2;
  const MAX_TIME_LABEL_COUNT = 6;
  const TARGET_LABEL_WIDTH_PX = 140;
  const SKELETON_SEED = 42;
  const SKELETON_SMOOTHNESS = 0.45;
  const SKELETON_SPIKINESS = 0.28;
  const SKELETON_MIN = 0.1;
  const SKELETON_MAX = 1;
  const SEVERITY_COLORS = {
    error: "var(--color-destructive)",
    warn: "#f59e0b",
    info: "color-mix(in oklab, var(--color-muted-foreground) 62%, transparent)",
    debug:
      "color-mix(in oklab, var(--color-muted-foreground) 25%, transparent)",
  } as const;
  const timestampFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  type ChartSegment = {
    color: string;
    count: number;
    height: number;
    key: string;
    label: string;
  };

  type SkeletonBar = {
    color: string;
    height: number;
    index: number;
    isClickable: boolean;
    key: string;
    label: string;
  };

  type ChartBar = SkeletonBar & {
    bucket?: LogVolumeBucket;
  };

  const generateBarDistribution = ({
    bucketSize,
    seed = 1,
    smoothness = 0.45,
    spikiness = 0.28,
    min = 0.1,
    max = 1,
  }: {
    bucketSize: number;
    seed?: number;
    smoothness?: number;
    spikiness?: number;
    min?: number;
    max?: number;
  }) => {
    const size = Math.max(0, Math.floor(bucketSize));

    if (size === 0) {
      return [];
    }

    let value = seed;
    const random = () => {
      value |= 0;
      value = (value + 0x6d2b79f5) | 0;

      let t = Math.imul(value ^ (value >>> 15), 1 | value);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let previous = 0.28 + random() * 0.38;

    return Array.from({ length: size }, () => {
      const noise = random();
      const spike = random() > 1 - spikiness * 0.55 ? random() * 0.46 : 0;
      const nextValue =
        previous * smoothness + noise * (1 - smoothness) + spike;

      previous = nextValue;

      return Math.min(max, Math.max(min, nextValue));
    });
  };

  const getBucketSegments = (
    bucket: LogVolumeBucket,
    barHeight: number,
  ): ChartSegment[] => {
    if (bucket.total === 0) {
      return [];
    }

    const groups = [
      {
        key: "debug",
        count: bucket.debug + bucket.trace,
        color: SEVERITY_COLORS.debug,
        label: "debug/trace",
      },
      {
        key: "info",
        count: bucket.info,
        color: SEVERITY_COLORS.info,
        label: "info",
      },
      {
        key: "warn",
        count: bucket.warn,
        color: SEVERITY_COLORS.warn,
        label: "warning",
      },
      {
        key: "error",
        count: bucket.error + bucket.fatal,
        color: SEVERITY_COLORS.error,
        label: "error",
      },
    ].filter((group) => group.count > 0);

    let allocatedHeight = 0;

    return groups.map((group, index) => {
      const remainingGroups = groups.length - index - 1;
      const rawHeight = Math.round((group.count / bucket.total) * barHeight);
      const height = Math.max(
        1,
        Math.min(barHeight - allocatedHeight - remainingGroups, rawHeight || 1),
      );

      allocatedHeight += height;

      return {
        color: group.color,
        count: group.count,
        height,
        key: group.key,
        label: group.label,
      };
    });
  };

  let {
    buckets = [],
    loading = false,
    skeletonBucketCount = 40,
    start,
    end,
    onBucketClick,
  }: {
    buckets?: LogVolumeBucket[];
    loading?: boolean;
    skeletonBucketCount?: number;
    start: Date;
    end: Date;
    onBucketClick?: (bucketStart: Date, bucketEnd: Date) => void;
  } = $props();
  let chartWidth = $state(0);

  const showSkeleton = $derived(loading && buckets.length === 0);
  const isRefreshing = $derived(loading && buckets.length > 0);

  const maxCount = $derived(
    Math.max(1, ...buckets.map((bucket) => bucket.total)),
  );
  const timeLabelCount = $derived.by(() =>
    Math.max(
      MIN_TIME_LABEL_COUNT,
      Math.min(
        MAX_TIME_LABEL_COUNT,
        chartWidth > 0
          ? Math.round(chartWidth / TARGET_LABEL_WIDTH_PX)
          : MAX_TIME_LABEL_COUNT,
      ),
    ),
  );
  const skeletonBars = $derived(
    generateBarDistribution({
      bucketSize: skeletonBucketCount,
      seed: SKELETON_SEED,
      smoothness: SKELETON_SMOOTHNESS,
      spikiness: SKELETON_SPIKINESS,
      min: SKELETON_MIN,
      max: SKELETON_MAX,
    }).map((value, index) => ({
      color: "var(--color-muted)",
      height: Math.max(MIN_BAR_HEIGHT, Math.round(value * CHART_HEIGHT)),
      index,
      isClickable: false,
      key: `skeleton-${index}`,
      label: `Loading bar ${index + 1}`,
    })) as SkeletonBar[],
  );

  const chartBars = $derived.by(() =>
    showSkeleton
      ? (skeletonBars as ChartBar[])
      : (buckets.map((bucket, index) => ({
          bucket,
          color:
            bucket.total === 0 ? "var(--color-border)" : SEVERITY_COLORS.info,
          height:
            bucket.total === 0
              ? 1
              : Math.max(
                  MIN_BAR_HEIGHT,
                  Math.round((bucket.total / maxCount) * CHART_HEIGHT),
                ),
          index,
          isClickable: bucket.total > 0,
          key: `${bucket.startAtUtc}-${bucket.endAtUtc}`,
          label: `Bucket ${index + 1}: ${bucket.total} logs`,
        })) as ChartBar[]),
  );

  const timeLabels = $derived.by(() =>
    Array.from({ length: timeLabelCount }, (_, index) => {
      const ratio = timeLabelCount === 1 ? 0 : index / (timeLabelCount - 1);
      const timestamp = new Date(
        start.getTime() + ratio * (end.getTime() - start.getTime()),
      );

      return {
        justifyClass:
          index === 0
            ? "justify-start"
            : index === timeLabelCount - 1
              ? "justify-end"
              : "justify-center",
        label: timeLabelFormatter.format(timestamp),
      };
    }),
  );

  const handleBucketClick = (bucket: LogVolumeBucket) => {
    if (bucket.total === 0) {
      return;
    }

    onBucketClick?.(new Date(bucket.startAtUtc), new Date(bucket.endAtUtc));
  };

  const handleBucketKeydown = (
    event: KeyboardEvent,
    bucket: LogVolumeBucket,
  ) => {
    if (bucket.total === 0 || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    handleBucketClick(bucket);
  };
</script>

<div
  data-testid="log-volume-chart"
  class="shrink-0 bg-background px-4 pt-1 pb-1"
  bind:clientWidth={chartWidth}
>
  <div class="w-full select-none">
    <div
      class="relative w-full"
      role="img"
      aria-label={showSkeleton ? "Loading log volume chart" : "Log volume over time"}
    >
      <div class="rounded-md px-2 pt-2 pb-0">
        <div
          class="relative flex items-end gap-0.5 transition-opacity duration-200"
          class:opacity-70={isRefreshing}
          style={`height: ${CHART_HEIGHT}px;`}
        >
          {#each chartBars as bar (bar.key)}
            <div class="relative flex min-w-0 flex-1 items-end justify-center">
              {#if bar.bucket}
                {@const bucket = bar.bucket}
                <HoverCard.Root openDelay={50} closeDelay={50}>
                  <HoverCard.Trigger
                    data-testid="log-volume-bucket"
                    type="button"
                    class={`w-full overflow-hidden rounded-t-[2px] rounded-b-none bg-linear-to-t from-foreground/30 to-transparent transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none ${
                      bucket.total > 0
                        ? "cursor-pointer opacity-85 hover:opacity-100 focus-visible:opacity-100"
                        : "cursor-default opacity-40 hover:opacity-60"
                    }`}
                    style={`height: ${bar.height}px;`}
                    aria-label={bar.label}
                    tabindex={bucket.total > 0 ? 0 : -1}
                    onclick={() => handleBucketClick(bucket)}
                    onkeydown={(event) => handleBucketKeydown(event, bucket)}
                  >
                    <div class="flex h-full w-full flex-col justify-end">
                      {#each getBucketSegments(bucket, bar.height) as segment (segment.key)}
                        <div
                          class="w-full"
                          style={`height: ${segment.height}px; background: ${segment.color};`}
                          aria-hidden="true"
                        ></div>
                      {/each}
                    </div>
                  </HoverCard.Trigger>
                  <HoverCard.Content class="w-72 text-sm">
                    <p class="mb-1 text-muted-foreground">
                      {timestampFormatter.format(new Date(bucket.startAtUtc))} →
                      {timestampFormatter.format(new Date(bucket.endAtUtc))}
                    </p>
                    <div class="flex flex-col gap-0.5">
                      {#if bucket.fatal + bucket.error > 0}
                        <div class="flex items-center gap-1.5">
                          <span
                            class="size-2 shrink-0 rounded-sm bg-destructive"
                          ></span>
                          <span class="text-foreground">
                            {bucket.fatal + bucket.error} error{bucket.fatal +
                              bucket.error !==
                            1
                              ? "s"
                              : ""}
                          </span>
                        </div>
                      {/if}
                      {#if bucket.warn > 0}
                        <div class="flex items-center gap-1.5">
                          <span
                            class="size-2 shrink-0 rounded-sm"
                            style={`background: ${SEVERITY_COLORS.warn};`}
                          ></span>
                          <span class="text-foreground">
                            {bucket.warn} warning{bucket.warn !== 1 ? "s" : ""}
                          </span>
                        </div>
                      {/if}
                      {#if bucket.info > 0}
                        <div class="flex items-center gap-1.5">
                          <span
                            class="size-2 shrink-0 rounded-sm"
                            style={`background: ${SEVERITY_COLORS.info};`}
                          ></span>
                          <span class="text-foreground">{bucket.info} info</span
                          >
                        </div>
                      {/if}
                      {#if bucket.debug + bucket.trace > 0}
                        <div class="flex items-center gap-1.5">
                          <span
                            class="size-2 shrink-0 rounded-sm"
                            style={`background: ${SEVERITY_COLORS.debug};`}
                          ></span>
                          <span class="text-foreground"
                            >{bucket.debug + bucket.trace} debug/trace</span
                          >
                        </div>
                      {/if}
                      {#if bucket.total === 0}
                        <span class="text-muted-foreground">No logs</span>
                      {/if}
                    </div>
                  </HoverCard.Content>
                </HoverCard.Root>
              {:else}
                <div
                  class="h-full w-full animate-pulse rounded-t-[2px] rounded-b-none bg-muted"
                  style={`height: ${bar.height}px;`}
                  aria-hidden="true"
                ></div>
              {/if}
            </div>
          {/each}

          {#if isRefreshing}
            <div
              class="pointer-events-none absolute inset-0 rounded-sm bg-background/10"
              aria-hidden="true"
            ></div>
          {/if}
        </div>

        <div class="-mx-2 h-px bg-border"></div>
      </div>

      <div
        class="grid"
        style={`grid-template-columns: repeat(${timeLabelCount}, minmax(0, 1fr));`}
        aria-hidden="true"
      >
        {#each timeLabels as label}
          <div class={`flex ${label.justifyClass}`}>
            <span class="h-2 w-px bg-border"></span>
          </div>
        {/each}
      </div>

      <div
        class="mt-1 mb-1 grid"
        style={`grid-template-columns: repeat(${timeLabelCount}, minmax(0, 1fr)); height: ${LABEL_HEIGHT}px;`}
      >
        {#each timeLabels as label}
          <div
            class={`flex min-w-0 overflow-hidden font-mono text-[0.75rem] text-muted-foreground ${label.justifyClass}`}
          >
            <span
              class="block overflow-hidden leading-5 text-ellipsis whitespace-nowrap"
            >
              {label.label}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
