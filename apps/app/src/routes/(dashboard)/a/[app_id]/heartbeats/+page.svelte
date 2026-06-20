<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { startAutoRefresh } from "$lib/browser/auto-refresh";
  import { createNowStore } from "$lib/stores/now";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import * as Tabs from "@repo/components/ui/tabs";
  import {
    IconAlertTriangle,
    IconChecks,
    IconCircle,
    IconCircleFilled,
    IconDotsVertical,
    IconFileDescription,
    IconList,
    IconPlayerPause,
    IconPlus,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Badge } from "@repo/components/ui/badge";
  import { formatDuration } from "@repo/utils";

  import PageContainer from "../_components/page-container/page-container.svelte";
  import CreateEditHeartbeatMonitor from "./_components/create-edit-heartbeat-monitor.svelte";
  import DeleteHeartbeatMonitorDialog from "./_components/delete-heartbeat-monitor-dialog.svelte";
  import EditHeartbeatMonitorDialog from "./_components/edit-heartbeat-monitor-dialog.svelte";
  import ToggleHeartbeatMonitorPausedDialog from "./_components/toggle-heartbeat-monitor-paused-dialog.svelte";

  let { data } = $props();

  const nowStore = createNowStore(1000);

  onMount(() => {
    return startAutoRefresh({
      refresh: () => invalidateAll(),
      intervalMs: 10_000,
    });
  });
</script>

<PageContainer
  title="Heartbeats"
  scrollContent={false}
  innerClass="min-h-0 px-0! gap-2 overflow-hidden"
>
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
    <CreateEditHeartbeatMonitor
      destinations={data.destinations}
      class={buttonVariants({ class: "hidden sm:flex" })}
    >
      <IconPlus />
      Create heartbeat
    </CreateEditHeartbeatMonitor>
    <CreateEditHeartbeatMonitor
      destinations={data.destinations}
      class={buttonVariants({ class: " sm:hidden", size: "icon" })}
    >
      <IconPlus />
    </CreateEditHeartbeatMonitor>
  {/snippet}

  <Tabs.Root value="all" class="flex min-h-0 flex-1 flex-col gap-0">
    <Tabs.List
      variant="line"
      class="flex h-8! w-full justify-start border-b px-3"
    >
      <Tabs.Trigger value="all" class="px-3 pb-3">
        <IconList class="size-3.5" />
        All
        <span
          class="items-center justify-center rounded-sm border border-primary/40 bg-primary/10 px-1 font-mono text-xs text-blue-800 tabular-nums"
          >{data.monitors.length}</span
        >
      </Tabs.Trigger>
      <Tabs.Trigger value="healthy" class="px-3 pb-3">
        <IconChecks class="size-3.5" />
        Healthy
        <span
          class="items-center justify-center rounded-sm border border-green-600/40 bg-green-600/10 px-1 font-mono text-xs text-green-800 tabular-nums"
        >
          {data.monitors.filter(
            (monitor) => monitor.status === "healthy" && !monitor.isPaused,
          ).length}
        </span>
      </Tabs.Trigger>
      <Tabs.Trigger value="missed" class="px-3 pb-3">
        <IconAlertTriangle class="size-3.5" />
        Missed
        <span
          class="items-center justify-center rounded-sm border border-red-600/40 bg-red-600/10 px-1 font-mono text-xs text-red-800 tabular-nums"
        >
          {data.monitors.filter((monitor) => monitor.status === "missed")
            .length}
        </span>
      </Tabs.Trigger>
      <Tabs.Trigger value="paused" class="px-3 pb-3">
        <IconPlayerPause class="size-3.5" />
        Paused
        <span
          class="items-center justify-center rounded-sm border border-muted-foreground/30 bg-muted-foreground/7 px-1 font-mono text-xs text-muted-foreground tabular-nums"
        >
          {data.monitors.filter((monitor) => monitor.isPaused).length}
        </span>
      </Tabs.Trigger>
    </Tabs.List>

    {#each ["all", "healthy", "missed", "paused"] as const as tab}
      <Tabs.Content value={tab} class="min-h-0 flex-1  p-3">
        {@render heartbeatMonitorList({ tab })}
      </Tabs.Content>
    {/each}
  </Tabs.Root>
</PageContainer>

{#snippet heartbeatMonitorList({
  tab,
}: {
  tab: "all" | "healthy" | "missed" | "paused";
})}
  {@const filteredMonitors = (() => {
    if (tab === "healthy")
      return data.monitors.filter(
        (monitor) => monitor.status === "healthy" && !monitor.isPaused,
      );
    if (tab === "missed")
      return data.monitors.filter((monitor) => monitor.status === "missed");
    if (tab === "paused")
      return data.monitors.filter((monitor) => monitor.isPaused);
    return data.monitors;
  })()}
  <Card.Root
    data-empty={filteredMonitors.length === 0 ? "true" : undefined}
    class="min-h-0 gap-0 divide-y overflow-y-auto rounded-xl p-0 data-empty:ring-0"
  >
    {#each filteredMonitors as monitor (monitor.id)}
      <div
        class="flex items-center gap-2 px-2 py-2 transition-colors hover:bg-muted/50"
      >
        <a
          class="flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-2 py-0.5 pt-0.75"
          href={`/a/${page.params.app_id}/heartbeats/${monitor.id}`}
        >
          <div class="flex flex-wrap items-center gap-2 text-sm font-medium">
            {monitor.name}
            <Badge
              variant="outline"
              class={cn(
                "gap-0.5 pr-1.5 pl-0.75",
                {
                  healthy: "border-green-600/20 bg-green-600/7 text-green-700 ",
                  grace: "border-amber-600/20 bg-amber-600/7 text-amber-800",
                  missed: "border-red-600/20 bg-red-600/7 text-red-800",
                  never_received:
                    "border-muted-foreground/20 bg-muted-foreground/7 text-muted-foreground",
                }[monitor.status],
                monitor.isPaused &&
                  "border-muted-foreground/20 bg-muted-foreground/7 text-muted-foreground",
              )}
            >
              {#if monitor.isPaused}
                <IconCircle class="size-2.5" />
              {:else}
                <IconCircleFilled class="size-2.5" />
              {/if}
              {monitor.isPaused
                ? "Paused"
                : monitor.status.toLocaleUpperCase()[0] +
                  monitor.status.slice(1).replaceAll("_", " ")}
            </Badge>
          </div>
          <div
            class="flex flex-wrap gap-0.75 gap-y-1 text-[0.8rem] text-muted-foreground"
          >
            Runs every <span class="font-medium text-secondary-foreground"
              >{formatDuration(monitor.expectedEverySeconds)}</span
            >
            with a grace period of
            <span class="font-medium text-secondary-foreground">
              {formatDuration(monitor.graceSeconds)}.
            </span>
            {#if monitor.lastCheckInAt}
              Last check-in was
              <span class="font-medium text-secondary-foreground"
                >{formatDuration(
                  monitor.lastCheckInAt
                    ? Math.floor(
                        ($nowStore -
                          new Date(monitor.lastCheckInAt).getTime()) /
                          1000,
                      )
                    : Infinity,
                )}</span
              >ago.
            {/if}
          </div>
        </a>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class={buttonVariants({
              variant: "ghost",
              size: "icon-sm",
            })}
            aria-label={`Open actions for ${monitor.name}`}
          >
            <IconDotsVertical />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-40">
            <EditHeartbeatMonitorDialog
              heartbeatMonitor={monitor}
              destinations={data.destinations}
            >
              {#snippet children({ openDialog })}
                <DropdownMenu.Item
                  onSelect={(event) => {
                    event.preventDefault();
                    openDialog();
                  }}
                >
                  Edit
                </DropdownMenu.Item>
              {/snippet}
            </EditHeartbeatMonitorDialog>
            <ToggleHeartbeatMonitorPausedDialog heartbeatMonitor={monitor}>
              {#snippet children({ openDialog })}
                <DropdownMenu.Item
                  onSelect={(event) => {
                    event.preventDefault();
                    openDialog();
                  }}
                >
                  {monitor.isPaused ? "Resume" : "Pause"}
                </DropdownMenu.Item>
              {/snippet}
            </ToggleHeartbeatMonitorPausedDialog>
            <DropdownMenu.Separator />
            <DeleteHeartbeatMonitorDialog heartbeatMonitor={monitor}>
              {#snippet children({ openDialog })}
                <DropdownMenu.Item
                  variant="destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    openDialog();
                  }}
                >
                  Delete
                </DropdownMenu.Item>
              {/snippet}
            </DeleteHeartbeatMonitorDialog>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    {:else}
      <div
        class="flex flex-col items-center text-sm text-muted-foreground pt-[5%]"
      >
        No heartbeat monitors found.
      </div>
    {/each}
  </Card.Root>
{/snippet}
