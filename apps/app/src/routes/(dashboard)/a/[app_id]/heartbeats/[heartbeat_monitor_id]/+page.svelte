<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import {
    sendHeartbeatMonitorTestAlertCommand,
    toggleHeartbeatMonitorPausedCommand,
  } from "$lib/api/heartbeats.remote";
  import { startAutoRefresh } from "$lib/browser/auto-refresh";
  import { createNowStore } from "$lib/stores/now";
  import { buttonVariants } from "@repo/components/ui/button";
  import { toast } from "@repo/components/ui/sonner";
  import * as Tooltip from "@repo/components/ui/tooltip";
  import { IconInfoCircle, IconPencilMinus } from "@tabler/icons-svelte";
  import { onMount } from "svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import CreateEditHeartbeatMonitor from "../_components/create-edit-heartbeat-monitor.svelte";

  let { data } = $props();

  const nowStore = createNowStore(1000);

  let pauseSubmitting = $state(false);
  let testAlertSubmitting = $state(false);

  const monitor = $derived(data.monitor);
  const history = $derived(data.history);
  const incidents = $derived(data.incidents ?? []);

  onMount(() => {
    return startAutoRefresh({
      refresh: () => invalidateAll(),
      intervalMs: 10_000,
    });
  });

  const currentStatus = $derived(
    monitor.isPaused
      ? "paused"
      : monitor.status === "healthy"
        ? "up"
        : monitor.status === "grace"
          ? "late"
          : monitor.status === "missed"
            ? "down"
            : "paused",
  );

  const statusLabel = $derived(
    currentStatus === "up"
      ? "Up"
      : currentStatus === "late"
        ? "Late"
        : currentStatus === "down"
          ? "Down"
          : "Paused",
  );

  const timeSinceLastCheckInSeconds = $derived(
    monitor.lastCheckInAt
      ? Math.max(
          Math.floor(
            ($nowStore - new Date(monitor.lastCheckInAt).getTime()) / 1000,
          ),
          0,
        )
      : null,
  );

  const totalWindowSeconds = $derived(
    monitor.expectedEverySeconds + monitor.graceSeconds,
  );

  const formatCompactDuration = (seconds: number | null) => {
    if (seconds === null || !Number.isFinite(seconds)) {
      return "00:00";
    }

    const total = Math.max(Math.floor(seconds), 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const formatRelativeTime = (value: Date | string | null) => {
    if (!value) {
      return "Waiting";
    }

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

  const formatAbsoluteTime = (value: Date | string | null) => {
    if (!value) {
      return "Waiting for first heartbeat";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };

  const progressPercent = $derived(
    monitor.isPaused ||
      timeSinceLastCheckInSeconds === null ||
      totalWindowSeconds <= 0
      ? 0
      : Math.min((timeSinceLastCheckInSeconds / totalWindowSeconds) * 100, 100),
  );

  const expectedWindowPercent = $derived(
    totalWindowSeconds <= 0
      ? 100
      : (monitor.expectedEverySeconds / totalWindowSeconds) * 100,
  );

  const nextBeatLabel = $derived.by(() => {
    if (monitor.isPaused) {
      return "Monitoring paused";
    }

    if (timeSinceLastCheckInSeconds === null) {
      return "Awaiting first beat";
    }

    if (timeSinceLastCheckInSeconds < monitor.expectedEverySeconds) {
      return "Next beat expected in";
    }

    if (timeSinceLastCheckInSeconds < totalWindowSeconds) {
      return "Grace period ends in";
    }

    return "Overdue by";
  });

  const nextBeatValue = $derived.by(() => {
    if (monitor.isPaused) {
      return monitor.pausedAt
        ? formatCompactDuration(
            Math.max(
              Math.floor(
                ($nowStore - new Date(monitor.pausedAt).getTime()) / 1000,
              ),
              0,
            ),
          )
        : "00:00";
    }

    if (timeSinceLastCheckInSeconds === null) {
      return formatCompactDuration(monitor.expectedEverySeconds);
    }

    if (timeSinceLastCheckInSeconds < monitor.expectedEverySeconds) {
      return formatCompactDuration(
        monitor.expectedEverySeconds - timeSinceLastCheckInSeconds,
      );
    }

    if (timeSinceLastCheckInSeconds < totalWindowSeconds) {
      return formatCompactDuration(
        totalWindowSeconds - timeSinceLastCheckInSeconds,
      );
    }

    return formatCompactDuration(
      timeSinceLastCheckInSeconds - totalWindowSeconds,
    );
  });

  const destinationChips = $derived(
    monitor.destinations.map((destination) => ({
      id: destination.id,
      label:
        destination.kind === "email"
          ? `Email · ${destination.name}`
          : destination.kind === "webhook"
            ? `Webhook · ${destination.name}`
            : destination.name,
    })),
  );

  const bars = $derived(history.buckets.slice(-60));

  const uptimePercent = $derived(
    history.buckets.length === 0
      ? "0.00%"
      : `${(
          ((history.buckets.length - history.stats.missedBuckets24h) /
            history.buckets.length) *
          100
        ).toFixed(2)}%`,
  );

  const averageIntervalLabel = $derived(
    history.stats.averageIntervalSeconds === null
      ? "Waiting"
      : formatCompactDuration(history.stats.averageIntervalSeconds),
  );

  const eventRows = $derived(
    history.buckets
      .slice()
      .reverse()
      .slice(0, 12)
      .map((bucket) => ({
        startAt: bucket.startAt,
        status:
          bucket.status === "healthy"
            ? "up"
            : bucket.status === "grace"
              ? "late"
              : "down",
        label:
          bucket.status === "healthy"
            ? `${bucket.count} beat${bucket.count === 1 ? "" : "s"} received`
            : bucket.status === "grace"
              ? "Within grace period"
              : "Missed beat",
        detail:
          bucket.status === "healthy"
            ? `Last activity ${formatAbsoluteTime(bucket.startAt)}`
            : bucket.status === "grace"
              ? `Expected interval elapsed ${formatAbsoluteTime(bucket.endAt)}`
              : `Grace expired ${formatAbsoluteTime(bucket.endAt)}`,
        meta:
          bucket.status === "healthy"
            ? `${bucket.count} check-in${bucket.count === 1 ? "" : "s"}`
            : bucket.status === "grace"
              ? "grace"
              : "down",
      })),
  );

  const tooltipText = {
    status:
      "Up: beat arrived on time. Late: beat arrived after the interval but within the grace period. Down: grace period expired with no beat. Paused: monitoring is switched off.",
    timing:
      "The bar shows the current cycle: green is the expected interval, amber is the grace period. The dot marks where the monitor is right now.",
    history:
      "Green: arrived on time. Amber: arrived late, after the interval but before grace ended. Red: grace expired with no beat.",
    uptime:
      "Share of recent heartbeat windows that did not miss their grace deadline.",
    average:
      "Average time between consecutive beats in the recent history window.",
    volume: "Number of heartbeat check-ins recorded in the last 24 hours.",
    incidents: "Current open incidents for this heartbeat monitor.",
  } as const;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Failed to copy.");
    }
  };

  const togglePaused = async () => {
    pauseSubmitting = true;
    const result = await toggleHeartbeatMonitorPausedCommand(monitor.id);
    pauseSubmitting = false;

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    await invalidateAll();
    toast.success(
      result.data.paused ? "Heartbeat paused." : "Heartbeat resumed.",
    );
  };

  const sendTestAlert = async () => {
    testAlertSubmitting = true;
    const result = await sendHeartbeatMonitorTestAlertCommand(monitor.id);
    testAlertSubmitting = false;

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Queued ${result.data.deliveryCount} test notification${result.data.deliveryCount === 1 ? "" : "s"}.`,
    );
  };
</script>

<PageContainer
  chat={{
    kind: "heartbeat",
    resourceId: monitor.id,
    label: monitor.name,
    metadata: { status: currentStatus },
  }}
  title={monitor.name}
  back={{ href: `/a/${page.params.app_id}/heartbeats`, title: "Heartbeats" }}
>
  {#snippet actions()}
    <CreateEditHeartbeatMonitor
      heartbeatMonitor={data.monitor}
      destinations={data.destinations}
      class={buttonVariants({ variant: "outline", class: "hidden sm:flex" })}
    >
      <IconPencilMinus />
      Create heartbeat
    </CreateEditHeartbeatMonitor>
    <CreateEditHeartbeatMonitor
      destinations={data.destinations}
      class={buttonVariants({
        variant: "outline",
        class: " sm:hidden",
        size: "icon",
      })}
    >
      <IconPencilMinus />
    </CreateEditHeartbeatMonitor>
  {/snippet}

  <div class="mb-4 grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-4">
    <div
      class="rounded-[8px] border border-border bg-background px-[18px] py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          Uptime (24h)
          <Tooltip.Root>
            <Tooltip.Trigger
              class="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconInfoCircle class="size-3" />
            </Tooltip.Trigger>
            <Tooltip.Content sideOffset={8} class="max-w-[220px] leading-5">
              {tooltipText.uptime}
            </Tooltip.Content>
          </Tooltip.Root>
        </span>
        <svg
          class="text-muted-foreground"
          width="56"
          height="20"
          viewBox="0 0 64 22"
          preserveAspectRatio="none"
        >
          <polyline
            points="0,6 8,7 16,5 24,8 32,6 40,9 48,6 56,7 64,5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="64" cy="5" r="2" fill="currentColor" />
        </svg>
      </div>
      <div class="text-[22px] font-semibold tracking-[-0.01em]">
        {uptimePercent}
      </div>
      <div class="mt-1 text-[11.5px] text-muted-foreground">
        {history.stats.missedBuckets24h} missed bucket{history.stats
          .missedBuckets24h === 1
          ? ""
          : "s"}
      </div>
    </div>

    <div
      class="rounded-[8px] border border-border bg-background px-[18px] py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          Avg interval
          <Tooltip.Root>
            <Tooltip.Trigger
              class="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconInfoCircle class="size-3" />
            </Tooltip.Trigger>
            <Tooltip.Content sideOffset={8} class="max-w-[220px] leading-5">
              {tooltipText.average}
            </Tooltip.Content>
          </Tooltip.Root>
        </span>
        <svg
          class="text-muted-foreground"
          width="56"
          height="20"
          viewBox="0 0 64 22"
          preserveAspectRatio="none"
        >
          <polyline
            points="0,11 8,9 16,12 24,10 32,13 40,9 48,11 56,8 64,10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="64" cy="10" r="2" fill="currentColor" />
        </svg>
      </div>
      <div class="text-[22px] font-semibold tracking-[-0.01em]">
        {averageIntervalLabel}
      </div>
      <div class="mt-1 text-[11.5px] text-muted-foreground">
        Target {formatCompactDuration(monitor.expectedEverySeconds)}
      </div>
    </div>

    <div
      class="rounded-[8px] border border-border bg-background px-[18px] py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          Beats in 24h
          <Tooltip.Root>
            <Tooltip.Trigger
              class="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconInfoCircle class="size-3" />
            </Tooltip.Trigger>
            <Tooltip.Content sideOffset={8} class="max-w-[220px] leading-5">
              {tooltipText.volume}
            </Tooltip.Content>
          </Tooltip.Root>
        </span>
        <svg
          class="text-muted-foreground"
          width="56"
          height="20"
          viewBox="0 0 64 22"
          preserveAspectRatio="none"
        >
          <polyline
            points="0,14 8,8 16,16 24,9 32,15 40,7 48,13 56,10 64,9"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="64" cy="9" r="2" fill="currentColor" />
        </svg>
      </div>
      <div class="text-[22px] font-semibold tracking-[-0.01em]">
        {history.stats.totalCheckIns24h}
      </div>
      <div class="mt-1 text-[11.5px] text-muted-foreground">
        Last beat {formatRelativeTime(monitor.lastCheckInAt)}
      </div>
    </div>

    <div
      class="rounded-[8px] border border-border bg-background px-[18px] py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          Open incidents
          <Tooltip.Root>
            <Tooltip.Trigger
              class="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconInfoCircle class="size-3" />
            </Tooltip.Trigger>
            <Tooltip.Content sideOffset={8} class="max-w-[220px] leading-5">
              {tooltipText.incidents}
            </Tooltip.Content>
          </Tooltip.Root>
        </span>
        <svg
          class="text-muted-foreground"
          width="56"
          height="20"
          viewBox="0 0 64 22"
          preserveAspectRatio="none"
        >
          <polyline
            points="0,20 8,18 16,16 24,14 32,12 40,10 48,8 56,6 64,4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="64" cy="4" r="2" fill="currentColor" />
        </svg>
      </div>
      <div class="text-[22px] font-semibold tracking-[-0.01em]">
        {incidents.length}
      </div>
      <div class="mt-1 text-[11.5px] text-muted-foreground">
        Current heartbeat incidents
      </div>
    </div>
  </div>

  <div
    class="mb-4 rounded-[8px] border border-border bg-background px-[22px] py-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
  >
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="flex items-center gap-1.5 text-[13px] font-semibold">
        Beat history - last {bars.length}
        <Tooltip.Root>
          <Tooltip.Trigger
            class="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconInfoCircle class="size-3.5" />
          </Tooltip.Trigger>
          <Tooltip.Content sideOffset={8} class="max-w-[236px] leading-5">
            {tooltipText.history}
          </Tooltip.Content>
        </Tooltip.Root>
      </h2>

      <div class="flex flex-wrap gap-4 text-[12.5px] text-muted-foreground">
        <span class="inline-flex items-center gap-1.5">
          <span class="size-[9px] rounded-[2px] bg-emerald-600"></span>
          On time
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-[9px] rounded-[2px] bg-amber-600"></span>
          Late (in grace)
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-[9px] rounded-[2px] bg-red-600"></span>
          Down
        </span>
      </div>
    </div>

    <div class="flex h-9 items-stretch gap-[3px]">
      {#each bars as bucket, index}
        <div
          class={`min-w-[3px] flex-1 rounded-[2px] transition-transform hover:scale-y-[1.08] ${
            bucket.status === "healthy"
              ? index >= bars.length - 6
                ? "bg-emerald-600"
                : "bg-emerald-200"
              : bucket.status === "grace"
                ? "bg-amber-600"
                : "bg-red-600"
          }`}
          title={`${formatAbsoluteTime(bucket.startAt)} · ${bucket.count} check-in${bucket.count === 1 ? "" : "s"}`}
        ></div>
      {/each}
    </div>

    <div
      class="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground"
    >
      <span>{formatAbsoluteTime(bars[0]?.startAt ?? null)}</span>
      <span>now</span>
    </div>
  </div>

  <div class="grid gap-[14px] xl:grid-cols-[minmax(0,1.7fr)_320px]">
    <div
      class="overflow-hidden rounded-[8px] border border-border bg-background shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
    >
      <div class="px-[22px] pt-[18px] pb-1">
        <h2 class="text-[13px] font-semibold">Event log</h2>
      </div>

      <div>
        {#each eventRows as row}
          <div
            class="grid grid-cols-[auto_88px_1fr_auto] items-center gap-[14px] border-t border-border px-[22px] py-[11px] text-[13px] transition-colors hover:bg-muted/30 max-md:grid-cols-[auto_1fr]"
          >
            <span
              class={`size-1.5 rounded-full ${
                row.status === "up"
                  ? "bg-emerald-600"
                  : row.status === "late"
                    ? "bg-amber-600"
                    : "bg-red-600"
              }`}
            ></span>
            <span class="font-mono text-muted-foreground max-md:hidden">
              {formatAbsoluteTime(row.startAt)}
            </span>
            <span class="min-w-0">
              <span class="block text-foreground">{row.label}</span>
              <span class="block text-muted-foreground">{row.detail}</span>
            </span>
            <span
              class="text-right font-mono text-muted-foreground max-md:hidden"
            >
              {row.meta}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <div
      class="overflow-hidden rounded-[8px] border border-border bg-background shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
    >
      <div class="px-[22px] pt-[18px] pb-1">
        <h2 class="text-[13px] font-semibold">Heartbeat details</h2>
      </div>

      <div class="space-y-4 border-t border-border px-[22px] py-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <span class="text-[12.5px] text-muted-foreground"
              >Heartbeat URL</span
            >
            <button
              type="button"
              class="text-[12.5px] font-medium text-foreground transition-colors hover:text-muted-foreground"
              onclick={() => copy(monitor.secretUrl)}
            >
              Copy
            </button>
          </div>
          <code
            class="block overflow-x-auto rounded-[6px] border border-border bg-muted/30 px-3 py-2 text-[12px] text-foreground"
          >
            {monitor.secretUrl}
          </code>
        </div>

        <div class="space-y-3 text-[13px]">
          <div class="flex items-start justify-between gap-3">
            <span class="text-muted-foreground">Status</span>
            <span class="font-medium text-foreground">{statusLabel}</span>
          </div>
          <div class="flex items-start justify-between gap-3">
            <span class="text-muted-foreground">Expected cadence</span>
            <span class="font-medium text-foreground">
              {formatCompactDuration(monitor.expectedEverySeconds)}
            </span>
          </div>
          <div class="flex items-start justify-between gap-3">
            <span class="text-muted-foreground">Grace period</span>
            <span class="font-medium text-foreground">
              {formatCompactDuration(monitor.graceSeconds)}
            </span>
          </div>
          <div class="flex items-start justify-between gap-3">
            <span class="text-muted-foreground">Last beat</span>
            <span class="text-right font-medium text-foreground">
              {formatRelativeTime(monitor.lastCheckInAt)}
            </span>
          </div>
          <div class="flex items-start justify-between gap-3">
            <span class="text-muted-foreground">Last seen at</span>
            <span class="text-right font-medium text-foreground">
              {formatAbsoluteTime(monitor.lastCheckInAt)}
            </span>
          </div>
          <div class="flex items-start justify-between gap-3">
            <span class="text-muted-foreground">Destinations</span>
            <span class="text-right font-medium text-foreground">
              {monitor.destinations.length}
            </span>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-[12.5px] text-muted-foreground">Channels</div>
          <div class="flex flex-wrap gap-2">
            {#if destinationChips.length === 0}
              <span
                class="inline-flex items-center rounded-full border border-dashed px-3 py-1.5 text-[12.5px] text-muted-foreground"
              >
                No channels
              </span>
            {:else}
              {#each destinationChips as chip}
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground"
                >
                  <span class="size-1.5 rounded-full bg-emerald-600"></span>
                  {chip.label}
                </span>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</PageContainer>
