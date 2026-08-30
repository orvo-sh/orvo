<script lang="ts">
  import * as Card from "@repo/components/ui/card";
  import { Badge } from "@repo/components/ui/badge";

  let {
    history,
    expectedEverySeconds,
  }: {
    history: {
      rangeStartAt: Date | string;
      rangeEndAt: Date | string;
      windowSeconds: number;
      bucketSizeSeconds: number;
      buckets: Array<{
        startAt: Date | string;
        endAt: Date | string;
        count: number;
        status: "healthy" | "missed" | "grace" | "pending";
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

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return remainingSeconds > 0
        ? `${hours}h ${minutes}m`
        : minutes > 0
          ? `${hours}h ${minutes}m`
          : `${hours}h`;
    }

    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatHistoryWindow = (seconds: number) => {
    const hours = Math.round(seconds / 3600);
    return hours < 48 ? `${hours} hours` : `${Math.round(hours / 24)} days`;
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

  const bucketClass = (
    status: "healthy" | "missed" | "grace" | "pending",
    count: number,
  ) => {
    if (count > 0 || status === "healthy") {
      return "bg-emerald-500/85";
    }

    if (status === "missed") {
      return "bg-destructive/80";
    }

    return status === "grace" ? "bg-amber-500/70" : "bg-muted-foreground/25";
  };

  const coveragePercent = $derived(
    history.buckets.length === 0
      ? 0
      : Math.round(
          (history.stats.receivedBuckets24h / history.buckets.length) * 100,
        ),
  );
</script>

<Card.Root class="gap-0">
  <Card.Header
    class="gap-4 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
  >
    <div class="space-y-1">
      <Card.Title class="text-base font-semibold">Heartbeat history</Card.Title>
      <Card.Description>
        Last {formatHistoryWindow(history.windowSeconds)} grouped into {formatInterval(
          history.bucketSizeSeconds,
        )} buckets.
      </Card.Description>
    </div>

    <div
      class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
    >
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-full bg-emerald-500/85"></span>
        Received
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-full bg-amber-500/70"></span>
        Grace window
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-full bg-destructive/80"></span>
        Missed
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-full bg-muted-foreground/25"></span>
        Waiting
      </span>
    </div>
  </Card.Header>

  <Card.Content
    class="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.95fr)]"
  >
    <div class="space-y-5">
      <div class="space-y-3">
        <div
          class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p
              class="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase"
            >
              Timeline coverage
            </p>
            <p class="mt-1 text-sm text-foreground">
              {history.stats.receivedBuckets24h} active bucket{history.stats
                .receivedBuckets24h === 1
                ? ""
                : "s"} in the last 24 hours
            </p>
          </div>
          <p class="text-xs font-medium text-muted-foreground">
            {coveragePercent}% coverage
          </p>
        </div>

        <div class="grid grid-cols-12 gap-1 sm:grid-cols-16 xl:grid-cols-24">
          {#each history.buckets as bucket}
            <div
              class={`h-9 rounded-sm transition-opacity hover:opacity-85 ${bucketClass(bucket.status, bucket.count)}`}
              title={`${formatBucketLabel(bucket.startAt)} · ${bucket.count} check-in${bucket.count === 1 ? "" : "s"}`}
            ></div>
          {/each}
        </div>

        <div
          class="flex items-center justify-between gap-3 font-mono text-[11px] text-muted-foreground"
        >
          <span>{formatBucketLabel(history.rangeStartAt)}</span>
          <span>{formatBucketLabel(history.rangeEndAt)}</span>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border bg-muted/20 px-3 py-3">
          <p class="text-xs text-muted-foreground">Check-ins in 24h</p>
          <p class="mt-1 text-xl font-semibold">
            {history.stats.totalCheckIns24h}
          </p>
        </div>
        <div class="rounded-xl border bg-muted/20 px-3 py-3">
          <p class="text-xs text-muted-foreground">Average interval</p>
          <p class="mt-1 text-xl font-semibold">
            {formatInterval(history.stats.averageIntervalSeconds)}
          </p>
        </div>
        <div class="rounded-xl border bg-muted/20 px-3 py-3">
          <p class="text-xs text-muted-foreground">Expected cadence</p>
          <p class="mt-1 text-xl font-semibold">
            {formatInterval(expectedEverySeconds)}
          </p>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-muted/15">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p class="text-sm font-medium">Recent check-ins</p>
          <p class="text-xs text-muted-foreground">
            Most recent delivery timestamps
          </p>
        </div>
        <Badge variant="outline" class="text-xs">
          {history.recentCheckIns.length}
        </Badge>
      </div>

      <div class="max-h-[320px] overflow-y-auto px-4 py-2">
        {#if history.recentCheckIns.length === 0}
          <p class="py-8 text-sm text-muted-foreground">
            No heartbeat check-ins have been recorded yet.
          </p>
        {:else}
          <div class="divide-y divide-border/70">
            {#each history.recentCheckIns as item}
              <div class="flex items-center justify-between gap-3 py-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium">
                    Received {formatTimeAgo(item.checkedInAt)}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {formatBucketLabel(item.checkedInAt)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  class="border-emerald-500/20 bg-emerald-500/8 text-emerald-700"
                >
                  Healthy
                </Badge>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </Card.Content>
</Card.Root>
