<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import {
    sendHeartbeatMonitorTestAlertCommand,
    toggleHeartbeatMonitorPausedCommand,
  } from "$lib/api/heartbeats.remote";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Dialog from "@repo/components/ui/dialog";
  import { toast } from "@repo/components/ui/sonner";
  import { formatDuration } from "@repo/utils";
  import {
    IconAlertTriangle,
    IconBellRinging,
    IconChevronRight,
    IconCopy,
    IconExternalLink,
    IconHeartbeat,
    IconPlayerPause,
    IconPlayerPlay,
  } from "@tabler/icons-svelte";
  import CreateEditHeartbeatMonitor from "../_components/create-edit-heartbeat-monitor.svelte";
  import HeartbeatCheckInHistory from "../_components/heartbeat-checkin-history.svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import IncidentsSection from "../../overview/_components/incidents-section.svelte";

  let { data } = $props();

  let pauseSubmitting = $state(false);
  let testAlertSubmitting = $state(false);
  let allIncidentsOpen = $state(false);

  const monitor = $derived(data.monitor);
  const history = $derived(data.history);
  const destinations = $derived(data.destinations);
  const incidents = $derived(data.incidents ?? []);

  const statusClasses = {
    healthy:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
    grace:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    missed: "border-destructive/30 bg-destructive/10 text-destructive",
    never_received: "border-border text-muted-foreground",
    paused: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  } as const;

  const formatTimestamp = (value: Date | string | null) => {
    if (!value) {
      return "Waiting";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };

  const formatTimeAgo = (value: Date | string | null) => {
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
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const currentStateLabel = $derived(
    monitor.isPaused
      ? "Paused"
      : monitor.status === "never_received"
        ? "Waiting"
        : monitor.status.replaceAll("_", " "),
  );

  const pendingForLabel = $derived(
    monitor.isPaused
      ? monitor.pausedAt
        ? `Paused ${formatTimeAgo(monitor.pausedAt)}`
        : "Paused"
      : monitor.lastCheckInAt
        ? formatTimeAgo(monitor.lastCheckInAt)
        : "Waiting",
  );

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
    toast.success(result.data.paused ? "Heartbeat paused." : "Heartbeat resumed.");
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

  const formatIncidentTimeAgo = (value: Date | string) => {
    const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };
</script>

<PageContainer title={monitor.name} back={`/a/${page.params.app_id}/heartbeats`}>
  {#snippet actions()}
    <CreateEditHeartbeatMonitor heartbeatMonitor={monitor} {destinations}>
      {#snippet child({ props })}
        <Button {...props} variant="outline">Edit</Button>
      {/snippet}
    </CreateEditHeartbeatMonitor>

    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button variant="outline">
          {#if monitor.isPaused}
            <IconPlayerPlay data-slot="button-icon" />
            Resume
          {:else}
            <IconPlayerPause data-slot="button-icon" />
            Pause
          {/if}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>
            {monitor.isPaused ? "Resume heartbeat monitor" : "Pause heartbeat monitor"}
          </AlertDialog.Title>
          <AlertDialog.Description>
            {#if monitor.isPaused}
              Resume missed-heartbeat evaluations and notification delivery for this monitor.
            {:else}
              Pause missed-heartbeat evaluations and notifications for this monitor until you resume it.
            {/if}
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onclick={togglePaused} disabled={pauseSubmitting}>
            {monitor.isPaused ? "Resume" : "Pause"}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>

    <Button
      variant="outline"
      loading={testAlertSubmitting}
      onclick={sendTestAlert}
    >
      <IconBellRinging data-slot="button-icon" />
      Send test alert
    </Button>
  {/snippet}

  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    <section class="rounded-xl border bg-background px-5 py-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              class={statusClasses[monitor.isPaused ? "paused" : monitor.status]}
            >
              {currentStateLabel}
            </Badge>
            <span class="text-sm text-muted-foreground">
              Every {formatDuration(monitor.expectedEverySeconds)} with{" "}
              {formatDuration(monitor.graceSeconds)} grace
            </span>
          </div>
          <h2 class="text-lg font-semibold">
            Make a `GET` or `POST` request to the following URL
          </h2>
          <p class="max-w-3xl text-sm text-muted-foreground">
            Use this secret heartbeat URL from your cron jobs, workers, or
            external checks. A recovered notification is sent when a previously
            missed monitor checks in again.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button variant="outline" onclick={() => copy(monitor.secretUrl)}>
            <IconCopy data-slot="button-icon" />
            Copy
          </Button>
          <Button href="https://orvo.sh/docs/heartbeats" variant="outline" target="_blank">
            <IconExternalLink data-slot="button-icon" />
            Docs
          </Button>
        </div>
      </div>

      <div class="mt-4 rounded-xl border bg-muted/20 px-4 py-4">
        <code class="block overflow-x-auto text-sm text-foreground">{monitor.secretUrl}</code>
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-3">
      <div class="rounded-xl border bg-background px-4 py-4">
        <p class="text-sm text-muted-foreground">Currently pending for</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight">{pendingForLabel}</p>
      </div>
      <div class="rounded-xl border bg-background px-4 py-4">
        <p class="text-sm text-muted-foreground">Last heartbeat recorded</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight">
          {monitor.lastCheckInAt ? formatTimeAgo(monitor.lastCheckInAt) : "Waiting"}
        </p>
        <p class="mt-2 text-xs text-muted-foreground">
          {formatTimestamp(monitor.lastCheckInAt)}
        </p>
      </div>
      <div class="rounded-xl border bg-background px-4 py-4">
        <p class="text-sm text-muted-foreground">Incidents</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight">{incidents.length}</p>
        <p class="mt-2 text-xs text-muted-foreground">
          Open app incidents currently active
        </p>
      </div>
    </section>

    <HeartbeatCheckInHistory
      history={history}
      expectedEverySeconds={monitor.expectedEverySeconds}
    />

    <section class="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
      <IncidentsSection
        {incidents}
        appId={page.params.app_id ?? ""}
        onViewAll={() => {
          allIncidentsOpen = true;
        }}
      />

      <div class="rounded-xl border bg-background">
        <div class="border-b border-border/70 px-4 py-3">
          <div class="flex items-center gap-2">
            <IconHeartbeat class="size-4 text-muted-foreground" />
            <h3 class="text-sm font-medium">Monitor details</h3>
          </div>
        </div>
        <div class="space-y-4 px-4 py-4">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted-foreground">
              Attached destinations
            </p>
            {#if monitor.destinations.length === 0}
              <p class="text-sm text-muted-foreground">No destinations attached.</p>
            {:else}
              <div class="flex flex-wrap gap-2">
                {#each monitor.destinations as destination}
                  <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
                    <span>{destination.name}</span>
                    <Badge variant="outline">
                      {destination.kind === "webhook" ? "Webhook" : "Email"}
                    </Badge>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border bg-muted/20 px-3 py-3">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">
                Last missed
              </p>
              <p class="mt-1 text-sm font-medium">
                {formatTimestamp(monitor.lastMissedAt)}
              </p>
            </div>
            <div class="rounded-lg border bg-muted/20 px-3 py-3">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">
                Last recovered
              </p>
              <p class="mt-1 text-sm font-medium">
                {formatTimestamp(monitor.lastRecoveredAt)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</PageContainer>

<Dialog.Root bind:open={allIncidentsOpen}>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <div class="flex items-center gap-2">
        <IconAlertTriangle class="size-4 text-destructive" />
        <Dialog.Title class="text-sm font-semibold">All open incidents</Dialog.Title>
        {#if incidents.length > 0}
          <span
            class="inline-flex h-5 items-center justify-center rounded-full border border-transparent bg-secondary px-2 text-xs font-medium text-secondary-foreground"
          >
            {incidents.length}
          </span>
        {/if}
      </div>
    </Dialog.Header>

    {#if incidents.length === 0}
      <div class="py-6 text-center text-sm text-muted-foreground">
        No open incidents.
      </div>
    {:else}
      <div class="divide-y divide-border/70">
        {#each incidents as incident (incident.id)}
          <a
            href={`/a/${page.params.app_id}/alerts`}
            class="flex items-center gap-3 py-3"
          >
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              <IconAlertTriangle class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{incident.rule.name}</p>
              <p class="line-clamp-2 text-xs text-muted-foreground">
                {incident.rule.signalType}
                {#if incident.lastObservedValue !== null}
                  · value {incident.lastObservedValue}
                {/if}
                · open for {formatIncidentTimeAgo(incident.openedAt)}
              </p>
            </div>
            <IconChevronRight class="size-4 shrink-0 text-muted-foreground" />
          </a>
        {/each}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
