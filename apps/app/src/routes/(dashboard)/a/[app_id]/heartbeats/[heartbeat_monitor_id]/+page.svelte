<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { startAutoRefresh } from "$lib/browser/auto-refresh";
  import { createNowStore } from "$lib/stores/now";
  import { Badge } from "@repo/components/ui/badge";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import * as InputGroup from "@repo/components/ui/input-group";
  import { toast } from "@repo/components/ui/sonner";
  import { formatDuration } from "@repo/utils";
  import {
    IconActivityHeartbeat,
    IconAlertTriangle,
    IconArrowRight,
    IconCopy,
    IconInfoCircle,
    IconPencil,
    IconPlayerPause,
    IconPlayerPlay,
    IconTrash,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import CreateEditHeartbeatMonitor from "../_components/create-edit-heartbeat-monitor.svelte";
  import DeleteHeartbeatMonitorDialog from "../_components/delete-heartbeat-monitor-dialog.svelte";
  import ToggleHeartbeatMonitorPausedDialog from "../_components/toggle-heartbeat-monitor-paused-dialog.svelte";

  let { data } = $props();

  const nowStore = createNowStore(1000);

  let editOpen = $state(false);
  let pauseOpen = $state(false);
  let deleteOpen = $state(false);
  let activeHistoryHover = $state<string | null>(null);

  const monitor = $derived(data.monitor);
  const history = $derived(data.history);
  const incidents = $derived(data.incidents ?? []);
  const incidentEvents = $derived(data.incidentEvents ?? []);

  onMount(() =>
    startAutoRefresh({
      refresh: () => invalidateAll(),
      intervalMs: 10_000,
    }),
  );

  const currentStatus = $derived(
    monitor.isPaused
      ? "paused"
      : monitor.status === "healthy"
        ? "up"
        : monitor.status === "grace"
          ? "late"
          : monitor.status === "missed"
            ? "down"
            : "waiting",
  );

  const statusLabel = $derived(
    currentStatus === "up"
      ? "Healthy"
      : currentStatus === "late"
        ? "Running late"
        : currentStatus === "down"
          ? "Heartbeat missed"
          : currentStatus === "paused"
            ? "Monitoring paused"
            : "Waiting for first heartbeat",
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
    if (seconds === null || !Number.isFinite(seconds)) return "—";

    const total = Math.max(Math.floor(seconds), 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;

    return hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const formatRelativeTime = (value: Date | string | null) => {
    if (!value) return "No heartbeat received";

    const seconds = Math.max(
      Math.floor(($nowStore - new Date(value).getTime()) / 1000),
      0,
    );

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatAbsoluteTime = (value: Date | string | null) =>
    value
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date(value))
      : "—";

  const formatHistoryWindow = (seconds: number) => {
    const hours = Math.round(seconds / 3600);
    return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
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
    if (monitor.isPaused) return "Paused for";
    if (timeSinceLastCheckInSeconds === null)
      return "First beat expected within";
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
        : "—";
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

  const bars = $derived(history.buckets.slice(-60));
  const evaluatedBuckets = $derived(
    history.buckets.filter(
      (bucket) => bucket.status === "healthy" || bucket.status === "missed",
    ),
  );
  const uptimePercent = $derived(
    evaluatedBuckets.length === 0
      ? "Waiting"
      : `${(
          (evaluatedBuckets.filter((bucket) => bucket.status === "healthy")
            .length /
            evaluatedBuckets.length) *
          100
        ).toFixed(2)}%`,
  );
  const activityRows = $derived(
    [
      ...history.buckets
        .filter(
          (bucket) => bucket.status === "healthy" || bucket.status === "grace",
        )
        .map((bucket) => ({
          id: `heartbeat:${bucket.startAt}`,
          occurredAt: bucket.endAt,
          title:
            bucket.status === "healthy"
              ? `${bucket.count} heartbeat${bucket.count === 1 ? "" : "s"} received`
              : "Heartbeat is running late",
          detail:
            bucket.status === "healthy"
              ? formatAbsoluteTime(bucket.startAt)
              : `Expected by ${formatAbsoluteTime(bucket.endAt)}`,
          tone: bucket.status === "healthy" ? "healthy" : "warning",
          incidentId: null,
        })),
      ...incidentEvents.map((event) => ({
        id: event.id,
        occurredAt: event.occurredAt,
        title:
          event.eventType === "incident.opened"
            ? "Incident opened"
            : event.eventType === "incident.resolved"
              ? "Incident resolved"
              : event.eventType === "incident.dismissed"
                ? "Incident dismissed"
                : event.eventType === "heartbeat.recovered"
                  ? "Heartbeat recovered"
                  : "Heartbeat missed",
        detail: event.incidentTitle,
        tone:
          event.eventType === "heartbeat.recovered" ||
          event.eventType === "incident.resolved"
            ? "healthy"
            : event.eventType === "incident.dismissed"
              ? "muted"
              : "critical",
        incidentId: event.incidentId,
      })),
    ]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      )
      .slice(0, 12),
  );

  const copyHeartbeatUrl = async () => {
    try {
      await navigator.clipboard.writeText(monitor.secretUrl);
      toast.success("Heartbeat URL copied.");
    } catch {
      toast.error("Failed to copy heartbeat URL.");
    }
  };
</script>

<PageContainer
  title={monitor.name}
  back={{ href: `/a/${page.params.app_id}/heartbeats`, title: "Heartbeats" }}
  contentClass="p-3"
  scout={{
    kind: "heartbeat",
    resourceId: monitor.id,
    label: monitor.name,
    metadata: {
      status: currentStatus,
      expectedEverySeconds: monitor.expectedEverySeconds,
      graceSeconds: monitor.graceSeconds,
      lastCheckInAt: monitor.lastCheckInAt?.toISOString() ?? null,
      uptime: uptimePercent,
      openIncidentCount: incidents.length,
    },
  }}
>
  {#snippet actions()}
    <CreateEditHeartbeatMonitor
      heartbeatMonitor={monitor}
      destinations={data.destinations}
      bind:open={editOpen}
    />
    <DeleteHeartbeatMonitorDialog
      heartbeatMonitor={monitor}
      bind:open={deleteOpen}
      onSuccess={() => goto(`/a/${page.params.app_id}/heartbeats`)}
    />
    <ToggleHeartbeatMonitorPausedDialog
      heartbeatMonitor={monitor}
      bind:open={pauseOpen}
    />

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline">Manage</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-40">
        <DropdownMenu.Item
          onSelect={() => queueMicrotask(() => (editOpen = true))}
        >
          <IconPencil />
          Edit
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => queueMicrotask(() => (pauseOpen = true))}
        >
          {#if monitor.isPaused}
            <IconPlayerPlay />
            Resume
          {:else}
            <IconPlayerPause />
            Pause
          {/if}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          variant="destructive"
          onSelect={() => queueMicrotask(() => (deleteOpen = true))}
        >
          <IconTrash />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/snippet}

  <div class="flex w-full flex-col gap-3">
    <section
      class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="flex min-w-0 items-start gap-3">
        <span
          class={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
            currentStatus === "up"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : currentStatus === "late"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : currentStatus === "down"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
          }`}
        >
          <IconActivityHeartbeat class="size-5" />
        </span>
        <div class="min-w-0">
          <h2 class="text-lg font-semibold">{statusLabel}</h2>
          {#if monitor.lastCheckInAt}
            <p class="mt-1 text-xs text-muted-foreground">
              Last heartbeat {formatRelativeTime(monitor.lastCheckInAt)} · {formatAbsoluteTime(
                monitor.lastCheckInAt,
              )}
            </p>
          {/if}
        </div>
      </div>

      <div class="shrink-0 sm:text-right">
        <p class="text-xs text-muted-foreground">{nextBeatLabel}</p>
        <p class="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {nextBeatValue}
        </p>
      </div>
    </section>

    <section class="flex flex-col">
      <Card.Root class="z-1 gap-0 overflow-hidden">
        <Card.Content class="p-0">
          <div class="px-5 py-4">
            <div class="relative h-2 rounded-full bg-muted">
              {#if currentStatus !== "paused" && timeSinceLastCheckInSeconds !== null}
                <span
                  class="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500/70"
                  style={`width: ${expectedWindowPercent}%`}
                ></span>
                <span
                  class="absolute inset-y-0 right-0 rounded-r-full bg-amber-500/70"
                  style={`width: ${100 - expectedWindowPercent}%`}
                ></span>
                <span
                  class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm"
                  style={`left: ${progressPercent}%`}
                ></span>
              {/if}
            </div>
            <div
              class="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"
            >
              <span
                >Expected every {formatDuration(
                  monitor.expectedEverySeconds,
                )}</span
              >
              <span>{formatDuration(monitor.graceSeconds)} grace</span>
            </div>
          </div>

          <div class="grid border-t sm:grid-cols-3 sm:divide-x">
            <div class="px-5 py-4">
              <p class="text-xs text-muted-foreground">
                Uptime · {formatHistoryWindow(history.windowSeconds)}
              </p>
              <p class="mt-1 text-lg font-semibold">{uptimePercent}</p>
            </div>
            <div class="border-t px-5 py-4 sm:border-t-0">
              <p class="text-xs text-muted-foreground">Average interval</p>
              <p class="mt-1 text-lg font-semibold">
                {history.stats.averageIntervalSeconds === null
                  ? "Waiting"
                  : formatDuration(history.stats.averageIntervalSeconds)}
              </p>
            </div>
            <div class="border-t px-5 py-4 sm:border-t-0">
              <p class="text-xs text-muted-foreground">
                Check-ins · {formatHistoryWindow(history.windowSeconds)}
              </p>
              <p class="mt-1 text-lg font-semibold">
                {history.stats.totalCheckIns24h}
              </p>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      {#if incidents.length > 0}
        <a
          href={`/a/${page.params.app_id}/incidents/${incidents[0].id}`}
          class="-mt-2 flex flex-wrap items-center gap-2 rounded-b-xl border border-foreground/10 bg-secondary px-3.5 pt-4 pb-2 text-sm text-secondary-foreground inset-shadow-[0px_-1px_--theme(--color-white)] transition-colors hover:bg-secondary/80"
        >
          <IconAlertTriangle class="size-4 shrink-0 text-muted-foreground" />
          <Badge variant="outline" class="h-5 bg-background/50 px-2 text-xs">
            {incidents.length} open incident{incidents.length === 1 ? "" : "s"}
          </Badge>
          <span class="text-xs text-muted-foreground">
            Opened {formatRelativeTime(incidents[0].openedAt)}
          </span>
          <span class="ml-auto inline-flex items-center gap-2 font-medium">
            View incident
            <IconArrowRight class="size-4" />
          </span>
        </a>
      {/if}
    </section>

    <section class="flex flex-col">
      <div
        class="rounded-t-xl border border-foreground/10 bg-secondary pb-2 inset-shadow-[0px_1px_--theme(--color-white)]"
      >
        <div class="flex items-center px-3.5 py-0.75">
          <h2 class="text-sm text-secondary-foreground">Check-in history</h2>
          <HoverCard.Root
            open={activeHistoryHover === "legend"}
            openDelay={50}
            closeDelay={0}
            onOpenChange={(open) => {
              if (open) {
                activeHistoryHover = "legend";
              } else if (activeHistoryHover === "legend") {
                activeHistoryHover = null;
              }
            }}
          >
            <HoverCard.Trigger
              aria-label="About check-in history"
              class={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <IconInfoCircle
                class="size-3.5 text-secondary-foreground opacity-75"
              />
            </HoverCard.Trigger>
            <HoverCard.Content class="w-64 text-sm" side="top" align="start">
              <div class="grid gap-2">
                <span class="inline-flex items-center gap-2">
                  <span class="size-2 rounded-sm bg-emerald-500"></span>
                  Received
                </span>
                <span class="inline-flex items-center gap-2">
                  <span class="size-2 rounded-sm bg-amber-500"></span>
                  Grace period
                </span>
                <span class="inline-flex items-center gap-2">
                  <span class="size-2 rounded-sm bg-destructive"></span>
                  Missed
                </span>
                <span class="inline-flex items-center gap-2">
                  <span class="size-2 rounded-sm bg-muted-foreground/25"></span>
                  Waiting
                </span>
              </div>
            </HoverCard.Content>
          </HoverCard.Root>
        </div>
      </div>
      <Card.Root class="z-1 -mt-2 gap-0 p-0">
        <Card.Content class="px-4 py-4">
          {#if bars.length === 0}
            <p class="py-6 text-center text-sm text-muted-foreground">
              No check-ins yet.
            </p>
          {:else}
            <div class="flex h-10 items-stretch gap-1">
              {#each bars as bucket (bucket.startAt)}
                {@const hoverId = `bucket:${bucket.startAt}`}
                <HoverCard.Root
                  open={activeHistoryHover === hoverId}
                  openDelay={50}
                  closeDelay={0}
                  onOpenChange={(open) => {
                    if (open) {
                      activeHistoryHover = hoverId;
                    } else if (activeHistoryHover === hoverId) {
                      activeHistoryHover = null;
                    }
                  }}
                >
                  <HoverCard.Trigger
                    type="button"
                    class={`min-w-1 flex-1 rounded-sm ${
                      bucket.status === "healthy"
                        ? "bg-emerald-500"
                        : bucket.status === "grace"
                          ? "bg-amber-500"
                          : bucket.status === "missed"
                            ? "bg-destructive"
                            : "bg-muted-foreground/20"
                    }`}
                    aria-label={`${bucket.status} from ${formatAbsoluteTime(bucket.startAt)} to ${formatAbsoluteTime(bucket.endAt)}`}
                  ></HoverCard.Trigger>
                  <HoverCard.Content class="w-64 text-sm" side="top">
                    <p class="text-muted-foreground">
                      {formatAbsoluteTime(bucket.startAt)} – {formatAbsoluteTime(
                        bucket.endAt,
                      )}
                    </p>
                    <div class="mt-2 flex items-center gap-2">
                      <span
                        class={`size-2 rounded-sm ${
                          bucket.status === "healthy"
                            ? "bg-emerald-500"
                            : bucket.status === "grace"
                              ? "bg-amber-500"
                              : bucket.status === "missed"
                                ? "bg-destructive"
                                : "bg-muted-foreground/25"
                        }`}
                      ></span>
                      <span class="font-medium">
                        {bucket.status === "healthy"
                          ? "Received"
                          : bucket.status === "grace"
                            ? "Grace period"
                            : bucket.status === "missed"
                              ? "Missed"
                              : "Waiting"}
                      </span>
                      {#if bucket.count > 0}
                        <span class="ml-auto text-muted-foreground">
                          {bucket.count} check-in{bucket.count === 1 ? "" : "s"}
                        </span>
                      {/if}
                    </div>
                  </HoverCard.Content>
                </HoverCard.Root>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </section>

    <div class="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
      <section class="flex flex-col">
        <div
          class="flex items-center rounded-t-xl border border-foreground/10 bg-secondary px-3.5 pt-2 pb-4 inset-shadow-[0px_1px_--theme(--color-white)]"
        >
          <h2 class="text-sm text-secondary-foreground">Recent activity</h2>
        </div>
        <Card.Root class="z-1 -mt-2 gap-0 overflow-hidden p-0">
          <Card.Content class="p-0">
            {#if activityRows.length === 0}
              <p class="px-5 py-10 text-center text-sm text-muted-foreground">
                No heartbeat activity has been recorded yet.
              </p>
            {:else}
              <div class="divide-y">
                {#each activityRows as activity (activity.id)}
                  <div
                    class="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3"
                  >
                    <span
                      class={`mt-1.5 size-2 rounded-full ${
                        activity.tone === "healthy"
                          ? "bg-emerald-500"
                          : activity.tone === "warning"
                            ? "bg-amber-500"
                            : activity.tone === "muted"
                              ? "bg-muted-foreground/40"
                              : "bg-destructive"
                      }`}
                    ></span>
                    <div class="min-w-0">
                      {#if activity.incidentId}
                        <a
                          class="text-sm font-medium hover:underline"
                          href={`/a/${page.params.app_id}/incidents/${activity.incidentId}`}
                          >{activity.title}</a
                        >
                      {:else}
                        <p class="text-sm font-medium">{activity.title}</p>
                      {/if}
                      <p class="text-xs text-muted-foreground">
                        {activity.detail}
                      </p>
                    </div>
                    <span class="font-mono text-xs text-muted-foreground">
                      {formatRelativeTime(activity.occurredAt)}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </section>

      <section class="flex h-fit flex-col">
        <div
          class="flex items-center rounded-t-xl border border-foreground/10 bg-secondary px-3.5 pt-2 pb-4 inset-shadow-[0px_1px_--theme(--color-white)]"
        >
          <h2 class="text-sm text-secondary-foreground">Monitor details</h2>
        </div>
        <Card.Root class="z-1 -mt-2 gap-0 p-0">
          <Card.Content class="p-0">
            <div class="border-b p-4">
              <span class="text-xs text-muted-foreground">Heartbeat URL</span>
              <InputGroup.Root class="mt-2">
                <InputGroup.Input
                  class="font-mono text-xs"
                  value={monitor.secretUrl}
                  readonly
                  title={monitor.secretUrl}
                />
                <InputGroup.Button
                  aria-label="Copy heartbeat URL"
                  onclick={copyHeartbeatUrl}
                >
                  <IconCopy data-slot="button-icon" />
                  Copy
                </InputGroup.Button>
              </InputGroup.Root>
            </div>

            <dl class="divide-y text-sm">
              <div class="flex items-center justify-between gap-3 px-4 py-3">
                <dt class="text-muted-foreground">Expected cadence</dt>
                <dd class="font-medium">
                  {formatDuration(monitor.expectedEverySeconds)}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3 px-4 py-3">
                <dt class="text-muted-foreground">Grace period</dt>
                <dd class="font-medium">
                  {formatDuration(monitor.graceSeconds)}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3 px-4 py-3">
                <dt class="text-muted-foreground">Last received</dt>
                <dd class="text-right font-medium">
                  {monitor.lastCheckInAt
                    ? formatRelativeTime(monitor.lastCheckInAt)
                    : "Never"}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-3 px-4 py-3">
                <dt class="pt-0.5 text-muted-foreground">Notifications</dt>
                <dd class="flex max-w-[65%] flex-wrap justify-end gap-1.5">
                  {#if monitor.destinations.length === 0}
                    <span class="text-sm font-medium">None</span>
                  {:else}
                    {#each monitor.destinations as destination (destination.id)}
                      <Badge variant="outline">
                        {destination.kind === "email"
                          ? `Email · ${destination.name}`
                          : destination.kind === "webhook"
                            ? `Webhook · ${destination.name}`
                            : `Slack · ${destination.name}`}
                      </Badge>
                    {/each}
                  {/if}
                </dd>
              </div>
            </dl>
          </Card.Content>
        </Card.Root>
      </section>
    </div>
  </div>
</PageContainer>
