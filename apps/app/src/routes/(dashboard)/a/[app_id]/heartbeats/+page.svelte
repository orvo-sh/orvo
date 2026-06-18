<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import {
    deleteHeartbeatMonitorCommand,
    regenerateHeartbeatMonitorSecretCommand,
  } from "$lib/api/heartbeats.remote";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Tabs from "@repo/components/ui/tabs";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconCopy,
    IconFileDescription,
    IconHeartbeat,
    IconKey,
    IconPlus,
    IconTrash,
  } from "@tabler/icons-svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import CreateEditHeartbeatMonitor from "./_components/create-edit-heartbeat-monitor.svelte";

  let { data } = $props();

  let deletingId = $state("");
  let regeneratingId = $state("");
  let tab = $state<"all" | "healthy" | "missed" | "paused">("all");

  const monitors = $derived(
    data.monitorsResult.success ? data.monitorsResult.data.monitors : [],
  );
  const destinations = $derived(
    data.destinationsResult.success
      ? data.destinationsResult.data.destinations
      : [],
  );
  const loadError = $derived(
    data.monitorsResult.success ? "" : data.monitorsResult.error,
  );
  const visibleMonitors = $derived(
    monitors.filter((monitor) => {
      if (tab === "healthy") {
        return monitor.status === "healthy" && !monitor.isPaused;
      }

      if (tab === "missed") {
        return monitor.status === "missed";
      }

      if (tab === "paused") {
        return monitor.isPaused;
      }

      return true;
    }),
  );

  const statusClasses = {
    healthy:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
    grace:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    missed: "border-destructive/30 bg-destructive/10 text-destructive",
    never_received: "border-border text-muted-foreground",
    paused: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  } as const;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Failed to copy.");
    }
  };

  const remove = async (id: string) => {
    deletingId = id;
    const result = await deleteHeartbeatMonitorCommand(id);
    deletingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    await invalidateAll();
    toast.success("Heartbeat monitor deleted.");
  };

  const regenerate = async (id: string) => {
    regeneratingId = id;
    const result = await regenerateHeartbeatMonitorSecretCommand(id);
    regeneratingId = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    await copy(result.data.secretUrl);
    await invalidateAll();
    toast.success("Heartbeat URL regenerated and copied.");
  };

  const formatRelativeWindow = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    if (seconds % 60 === 0) {
      return `${seconds / 60}m`;
    }

    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const formatTimestamp = (value: Date | string | null) => {
    if (!value) {
      return "Never";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };
</script>

<PageContainer title="Heartbeats">
  {#snippet helper()}
    <div class="space-y-2">
      <p>
        Heartbeats let you monitor scheduled jobs, workers, and external checks
        that should report in on a fixed cadence.
      </p>
      <p>
        Each monitor gets a secret URL that accepts <code>GET</code> or
        <code>POST</code>. If a check-in is missed past the cadence and grace
        window, Orvo sends the attached webhook and email notifications once,
        then sends a recovery notification when the monitor checks in again.
      </p>
      <Button
        href="https://orvo.sh/docs/heartbeats"
        size="sm"
        target="_blank"
        variant="outline"
        class="mt-2 w-full"
      >
        <IconFileDescription data-slot="button-icon" />
        Heartbeats docs
      </Button>
    </div>
  {/snippet}
  {#snippet actions()}
    <CreateEditHeartbeatMonitor {destinations}>
      {#snippet child({ props })}
        <Button {...props}>
          <IconPlus data-slot="button-icon" />
          Create heartbeat
        </Button>
      {/snippet}
    </CreateEditHeartbeatMonitor>
  {/snippet}

  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4">
    <Tabs.Root bind:value={tab} class="gap-0">
      <Tabs.List
        class="h-auto w-full justify-start gap-2 rounded-none border-b bg-transparent p-0"
      >
        <Tabs.Trigger
          value="all"
          class="h-10 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-1 data-active:border-foreground"
        >
          All
          <span class="text-xs text-muted-foreground">{monitors.length}</span>
        </Tabs.Trigger>
        <Tabs.Trigger
          value="healthy"
          class="h-10 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-1 data-active:border-foreground"
        >
          Healthy
          <span class="text-xs text-muted-foreground">
            {monitors.filter(
              (monitor) => monitor.status === "healthy" && !monitor.isPaused,
            ).length}
          </span>
        </Tabs.Trigger>
        <Tabs.Trigger
          value="missed"
          class="h-10 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-1 data-active:border-foreground"
        >
          Missed
          <span class="text-xs text-muted-foreground">
            {monitors.filter((monitor) => monitor.status === "missed").length}
          </span>
        </Tabs.Trigger>
        <Tabs.Trigger
          value="paused"
          class="h-10 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-1 data-active:border-foreground"
        >
          Paused
          <span class="text-xs text-muted-foreground">
            {monitors.filter((monitor) => monitor.isPaused).length}
          </span>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>

    {#if loadError}
      <div
        class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {loadError}
      </div>
    {/if}

    {#if monitors.length === 0}
      <section class="relative overflow-hidden rounded-xl border bg-background">
        <div
          class="absolute inset-0 opacity-40"
          style="background-image: repeating-linear-gradient(135deg, transparent, transparent 16px, color-mix(in oklab, var(--color-border) 24%, transparent) 16px, color-mix(in oklab, var(--color-border) 24%, transparent) 17px);"
        ></div>
        <div class="relative mx-auto flex min-h-[420px] max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
          <div class="rounded-full border bg-background/90 p-3 shadow-sm">
            <IconHeartbeat class="size-5 text-muted-foreground" />
          </div>
          <h3 class="text-3xl font-semibold tracking-tight">No heartbeats</h3>
          <p class="max-w-md text-sm text-muted-foreground">
            Add your first heartbeat monitor to track scheduled jobs, workers,
            and external checks.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <CreateEditHeartbeatMonitor {destinations}>
              {#snippet child({ props })}
                <Button {...props}>
                  <IconPlus data-slot="button-icon" />
                  Add first heartbeat
                </Button>
              {/snippet}
            </CreateEditHeartbeatMonitor>
            <Button
              href="https://orvo.sh/docs/heartbeats"
              target="_blank"
              variant="outline"
            >
              <IconFileDescription data-slot="button-icon" />
              View docs
            </Button>
          </div>
        </div>
      </section>
    {:else if visibleMonitors.length === 0}
      <section class="rounded-xl border bg-background px-6 py-16 text-center">
        <div class="mx-auto flex max-w-md flex-col items-center gap-3">
          <div class="rounded-full border bg-muted/30 p-3">
            <IconHeartbeat class="size-5 text-muted-foreground" />
          </div>
          <h3 class="text-lg font-semibold">No heartbeats in this view</h3>
          <p class="text-sm text-muted-foreground">
            Try another tab or create a new heartbeat monitor.
          </p>
          <CreateEditHeartbeatMonitor {destinations}>
            {#snippet child({ props })}
              <Button {...props}>
                <IconPlus data-slot="button-icon" />
                Create heartbeat
              </Button>
            {/snippet}
          </CreateEditHeartbeatMonitor>
        </div>
      </section>
    {:else}
      <section class="overflow-hidden rounded-xl border bg-background">
        {#each visibleMonitors as monitor, index (monitor.id)}
          <article
            class:border-b={index !== visibleMonitors.length - 1}
            class="border-border/70 px-5 py-4"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="min-w-0 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <a
                    href={`/a/${page.params.app_id}/heartbeats/${monitor.id}`}
                    class="truncate text-base font-medium hover:underline"
                  >
                    {monitor.name}
                  </a>
                  <Badge
                    variant="outline"
                    class={statusClasses[monitor.isPaused ? "paused" : monitor.status]}
                  >
                    {monitor.isPaused ? "Paused" : monitor.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>Every {formatRelativeWindow(monitor.expectedEverySeconds)}</span>
                  <span>Grace {formatRelativeWindow(monitor.graceSeconds)}</span>
                  <span>Last check-in {formatTimestamp(monitor.lastCheckInAt)}</span>
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => copy(monitor.secretUrl)}
                >
                  <IconCopy data-slot="button-icon" />
                  Copy URL
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  loading={regeneratingId === monitor.id}
                  onclick={() => regenerate(monitor.id)}
                >
                  <IconKey data-slot="button-icon" />
                  Regenerate
                </Button>
                <CreateEditHeartbeatMonitor
                  heartbeatMonitor={monitor}
                  {destinations}
                >
                  {#snippet child({ props })}
                    <Button {...props} variant="outline" size="sm">Edit</Button>
                  {/snippet}
                </CreateEditHeartbeatMonitor>
                <Button
                  variant="outline"
                  size="sm"
                  loading={deletingId === monitor.id}
                  onclick={() => remove(monitor.id)}
                >
                  <IconTrash data-slot="button-icon" />
                  Delete
                </Button>
              </div>
            </div>
          </article>
        {/each}
      </section>
    {/if}
  </div>
</PageContainer>
