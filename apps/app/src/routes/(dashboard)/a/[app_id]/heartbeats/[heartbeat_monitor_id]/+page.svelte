<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { useChatState } from "$lib/chat";
  import { getHeartbeatSuggestions } from "$lib/heartbeats/heartbeat-suggestions";
  import { startAutoRefresh } from "$lib/browser/auto-refresh";
  import { createNowStore } from "$lib/stores/now";
  import { Button } from "@repo/components/ui/button";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { toast } from "@repo/components/ui/sonner";
  import { formatDuration } from "@repo/utils";
  import {
    IconAlertTriangle,
    IconArrowRight,
    IconCopy,
    IconDots,
    IconWorld,
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
  const chat = useChatState();

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

  const nextCheckInSummary = $derived.by(() => {
    if (monitor.isPaused) return "Monitoring is paused.";
    if (timeSinceLastCheckInSeconds === null)
      return "No check-ins received yet.";
    if (timeSinceLastCheckInSeconds < monitor.expectedEverySeconds)
      return `Next check-in expected in ${formatDuration(monitor.expectedEverySeconds - timeSinceLastCheckInSeconds)}`;
    if (timeSinceLastCheckInSeconds < totalWindowSeconds)
      return `Grace period ends in ${formatDuration(totalWindowSeconds - timeSinceLastCheckInSeconds)}`;
    return `Overdue by ${formatDuration(timeSinceLastCheckInSeconds - totalWindowSeconds)}`;
  });
  const bars = $derived(history.buckets.slice(-30));
  const bucketStyles = {
    healthy: { label: "Received", color: "bg-emerald-500" },
    grace: { label: "Grace period", color: "bg-amber-500" },
    missed: { label: "Missed", color: "bg-destructive" },
    pending: { label: "Waiting", color: "bg-muted-foreground/20" },
  };
  const activityRows = $derived(
    [
      ...history.recentCheckIns.map((checkIn, index) => ({
        id: `check-in:${checkIn.checkedInAt}:${index}`,
        occurredAt: checkIn.checkedInAt,
        title: "Check-in received",
        detail: null,
        tone: "healthy",
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

  const heartbeatChatContext = $derived({
    kind: "heartbeat",
    resourceId: monitor.id,
    label: monitor.name,
    metadata: {
      status: currentStatus,
      expectedEverySeconds: monitor.expectedEverySeconds,
      graceSeconds: monitor.graceSeconds,
      lastCheckInAt: monitor.lastCheckInAt?.toISOString() ?? null,
      openIncidentCount: incidents.length,
    },
  } satisfies import("$lib/chat").ChatContextDescriptor);

  $effect(() => {
    chat.heartbeatPrompts = getHeartbeatSuggestions(monitor);
    if (chat.railOpen) chat.context = $state.snapshot(heartbeatChatContext);
    return () => {
      chat.heartbeatPrompts = [];
    };
  });

  const copyValue = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };
</script>

<PageContainer
  title={monitor.name}
  back={{ href: `/a/${page.params.app_id}/heartbeats`, title: "Heartbeats" }}
  contentClass="px-4 py-6 sm:px-6 sm:py-7"
  scout={heartbeatChatContext}
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
          <Button
            {...props}
            variant="ghost"
            size="icon"
            aria-label="Manage heartbeat"
            ><IconDots data-slot="button-icon" /></Button
          >
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-48">
        <DropdownMenu.Item
          onSelect={() =>
            void copyValue(monitor.secretUrl, "Check-in URL copied.")}
        >
          <IconCopy /> Copy check-in URL
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
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
        <DropdownMenu.Separator />
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

  <div class="flex w-full max-w-5xl flex-col gap-8">
    <section
      class="flex flex-wrap items-center justify-between gap-4"
      aria-label="Heartbeat status"
    >
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-3">
          <span class="inline-flex items-center gap-2 text-sm font-medium">
            <span
              class={`size-2 rounded-full ${currentStatus === "up" ? "bg-emerald-500" : currentStatus === "late" ? "bg-amber-500" : currentStatus === "down" ? "bg-destructive" : "bg-muted-foreground/50"}`}
            ></span>
            {statusLabel}
          </span>
          {#if monitor.lastCheckInAt}
            <span class="text-sm text-muted-foreground"
              >Last check-in {formatRelativeTime(monitor.lastCheckInAt)}</span
            >
          {/if}
        </div>
        <p class="text-sm text-muted-foreground tabular-nums">
          {nextCheckInSummary}
        </p>
      </div>
    </section>

    {#if incidents.length > 0}
      <a
        href={`/a/${page.params.app_id}/incidents/${incidents[0].id}`}
        class="flex flex-wrap items-center gap-3 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm transition-colors hover:bg-destructive/10"
      >
        <IconAlertTriangle class="size-4 shrink-0 text-destructive" />
        <span class="font-medium"
          >{incidents.length} open incident{incidents.length === 1
            ? ""
            : "s"}</span
        >
        <span class="text-muted-foreground"
          >Opened {formatRelativeTime(incidents[0].openedAt)}</span
        >
        <span class="ml-auto inline-flex items-center gap-2"
          >View incident <IconArrowRight class="size-4" /></span
        >
      </a>
    {/if}

    {#if !monitor.lastCheckInAt}
      <section
        class="space-y-4 rounded-lg border border-border bg-muted/20 p-4 sm:p-5"
        aria-label="Connect heartbeat"
      >
        <div class="space-y-1">
          <h2 class="text-sm font-medium">Send your first check-in</h2>
          <p class="text-sm text-muted-foreground">
            Call this URL when your job finishes.
          </p>
        </div>
        <div
          class="flex min-w-0 items-center gap-3 rounded-md bg-muted px-3 py-2"
        >
          <IconWorld class="size-4 shrink-0 text-muted-foreground" />
          <code class="min-w-0 flex-1 overflow-x-auto text-xs whitespace-nowrap"
            >{monitor.secretUrl}</code
          >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy check-in URL"
            onclick={() =>
              void copyValue(monitor.secretUrl, "Check-in URL copied.")}
            ><IconCopy data-slot="button-icon" /></Button
          >
        </div>
      </section>
    {/if}

    <section class="space-y-4" aria-label="Check-in history">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-medium">Check-in history</h2>
        <div class="flex flex-wrap items-center gap-3">
          {#each Object.values(bucketStyles) as status}
            <span
              class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              ><span class={`size-1.5 rounded-sm ${status.color}`}
              ></span>{status.label}</span
            >
          {/each}
        </div>
      </div>
      {#if !monitor.lastCheckInAt || bars.length === 0}
        <div
          class="flex h-12 items-center justify-center rounded-md bg-muted/40 text-sm text-muted-foreground"
        >
          Check-ins will appear here once connected.
        </div>
      {:else}
        <div class="flex h-9 items-stretch gap-1">
          {#each bars as bucket (bucket.startAt)}
            {@const hoverId = `bucket:${bucket.startAt}`}
            <HoverCard.Root
              open={activeHistoryHover === hoverId}
              openDelay={50}
              closeDelay={0}
              onOpenChange={(open) => {
                activeHistoryHover = open ? hoverId : null;
              }}
            >
              <HoverCard.Trigger
                type="button"
                class={`min-w-0 flex-1 cursor-help rounded-sm ${bucketStyles[bucket.status].color}`}
                aria-label={`${bucketStyles[bucket.status].label} from ${formatAbsoluteTime(bucket.startAt)} to ${formatAbsoluteTime(bucket.endAt)}`}
              ></HoverCard.Trigger>
              <HoverCard.Content class="w-64 space-y-2 text-sm" side="top">
                <p class="text-muted-foreground">
                  {formatAbsoluteTime(bucket.startAt)} – {formatAbsoluteTime(
                    bucket.endAt,
                  )}
                </p>
                <p class="font-medium">
                  {bucketStyles[bucket.status].label}{bucket.count > 0
                    ? ` · ${bucket.count} check-in${bucket.count === 1 ? "" : "s"}`
                    : ""}
                </p>
              </HoverCard.Content>
            </HoverCard.Root>
          {/each}
        </div>
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>{formatAbsoluteTime(bars[0]?.startAt ?? null)}</span><span
            >Now</span
          >
        </div>
      {/if}
    </section>

    <div
      class="grid items-start gap-8 border-t pt-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10"
    >
      <section aria-label="Recent activity">
        <h2 class="mb-3 text-sm font-medium">Recent activity</h2>
        {#if activityRows.length === 0}
          <p class="py-3 text-sm text-muted-foreground">No activity yet.</p>
        {:else}
          <div class="divide-y">
            {#each activityRows as activity (activity.id)}
              <div class="flex items-start gap-3 py-3">
                <span
                  class={`mt-1.5 size-1.5 shrink-0 rounded-full ${activity.tone === "healthy" ? "bg-emerald-500" : activity.tone === "muted" ? "bg-muted-foreground/40" : "bg-destructive"}`}
                ></span>
                <div class="min-w-0 flex-1">
                  {#if activity.incidentId}<a
                      class="text-sm font-medium hover:underline"
                      href={`/a/${page.params.app_id}/incidents/${activity.incidentId}`}
                      >{activity.title}</a
                    >
                  {:else}<p class="text-sm">{activity.title}</p>{/if}
                  {#if activity.detail}<p
                      class="truncate text-sm text-muted-foreground"
                    >
                      {activity.detail}
                    </p>{/if}
                </div>
                <span
                  class="shrink-0 text-xs text-muted-foreground"
                  title={formatAbsoluteTime(activity.occurredAt)}
                  >{formatRelativeTime(activity.occurredAt)}</span
                >
              </div>
            {/each}
          </div>
        {/if}
      </section>
      <section aria-label="Configuration">
        <h2 class="mb-3 text-sm font-medium">Configuration</h2>
        <dl class="space-y-4 text-sm">
          <div class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Expected every</dt>
            <dd>{formatDuration(monitor.expectedEverySeconds)}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Grace period</dt>
            <dd>{formatDuration(monitor.graceSeconds)}</dd>
          </div>
          <div class="flex items-start justify-between gap-4">
            <dt class="text-muted-foreground">Notifications</dt>
            <dd class="min-w-0 space-y-1 text-right">
              {#if monitor.destinations.length === 0}
                <span class="text-muted-foreground">None selected</span>
              {:else}
                {#each monitor.destinations as destination (destination.id)}
                  <a
                    class="block break-words underline underline-offset-4 hover:text-primary"
                    href={`/a/${page.params.app_id}/settings/notification-destinations#${encodeURIComponent(destination.id)}`}
                    >{destination.name}</a
                  >
                {/each}
              {/if}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</PageContainer>
