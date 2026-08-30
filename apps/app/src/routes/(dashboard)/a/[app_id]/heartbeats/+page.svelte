<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { startAutoRefresh } from "$lib/browser/auto-refresh";
  import { createNowStore } from "$lib/stores/now";
  import { buttonVariants } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import { toast } from "@repo/components/ui/sonner";
  import * as Tabs from "@repo/components/ui/tabs";
  import {
    IconAlertTriangle,
    IconChecks,
    IconCircle,
    IconCircleFilled,
    IconCopy,
    IconDotsVertical,
    IconList,
    IconPencilMinus,
    IconPlayerPause,
    IconPlayerPlay,
    IconPlus,
    IconTrash,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Badge } from "@repo/components/ui/badge";
  import { formatDuration } from "@repo/utils";

  import PageContainer from "../_components/page-container/page-container.svelte";
  import CreateEditHeartbeatMonitor from "./_components/create-edit-heartbeat-monitor.svelte";
  import DeleteHeartbeatMonitorDialog from "./_components/delete-heartbeat-monitor-dialog.svelte";
  import ToggleHeartbeatMonitorPausedDialog from "./_components/toggle-heartbeat-monitor-paused-dialog.svelte";

  let { data } = $props();

  const nowStore = createNowStore(1000);

  let selectedHeartbeatMonitor = $state<{
    id: string;
    name: string;
    expectedEverySeconds: number;
    isPaused: boolean;
    graceSeconds: number;
    destinationIds: string[];
  } | null>(null);
  let isEditModalOpen = $state(false);
  let isDeleteDialogOpen = $state(false);
  let isPauseDialogOpen = $state(false);

  onMount(() => {
    return startAutoRefresh({
      refresh: () => invalidateAll(),
      intervalMs: 10_000,
    });
  });
</script>

<PageContainer
  title="Heartbeats"
  contentClass="min-h-0 p-0! gap-2 overflow-hidden"
  scout={{
    kind: "heartbeat",
    resourceId: "heartbeats",
    label: "Heartbeats",
    metadata: {
      total: data.monitors.length,
      healthy: data.monitors.filter(
        (monitor) => monitor.status === "healthy" && !monitor.isPaused,
      ).length,
      missed: data.monitors.filter((monitor) => monitor.status === "missed")
        .length,
      paused: data.monitors.filter((monitor) => monitor.isPaused).length,
    },
  }}
>
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
      class="flex h-13! w-full justify-start border-b px-3"
    >
      <Tabs.Trigger value="all" class="px-3 not-sm:flex-1">
        <IconList class="size-3.5 not-sm:hidden" />
        All
        <span
          class="items-center justify-center rounded-sm border border-primary/40 bg-primary/10 px-1 font-mono text-xs text-blue-800 tabular-nums not-sm:hidden"
          >{data.monitors.length}</span
        >
      </Tabs.Trigger>
      <Tabs.Trigger value="healthy" class="px-3 not-sm:flex-1 ">
        <IconChecks class="size-3.5 not-sm:hidden" />
        Healthy
        <span
          class="items-center justify-center rounded-sm border border-green-600/40 bg-green-600/10 px-1 font-mono text-xs text-green-800 tabular-nums not-sm:hidden"
        >
          {data.monitors.filter(
            (monitor) => monitor.status === "healthy" && !monitor.isPaused,
          ).length}
        </span>
      </Tabs.Trigger>
      <Tabs.Trigger value="missed" class="px-3 not-sm:flex-1 ">
        <IconAlertTriangle class="size-3.5 not-sm:hidden" />
        Missed
        <span
          class="items-center justify-center rounded-sm border border-red-600/40 bg-red-600/10 px-1 font-mono text-xs text-red-800 tabular-nums not-sm:hidden"
        >
          {data.monitors.filter((monitor) => monitor.status === "missed")
            .length}
        </span>
      </Tabs.Trigger>
      <Tabs.Trigger value="paused" class="px-3 not-sm:flex-1">
        <IconPlayerPause class="size-3.5 not-sm:hidden" />
        Paused
        <span
          class="items-center justify-center rounded-sm border border-muted-foreground/30 bg-muted-foreground/7 px-1 font-mono text-xs text-muted-foreground tabular-nums not-sm:hidden"
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
    class="max-h-full min-h-0 gap-0 divide-y overflow-y-auto rounded-xl p-0 data-empty:bg-transparent data-empty:shadow-none data-empty:ring-0"
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
            <DropdownMenu.Item
              onSelect={async () => {
                try {
                  await navigator.clipboard.writeText(monitor.url);
                  toast.success("Heartbeat URL copied.");
                } catch {
                  toast.error("Failed to copy heartbeat URL.");
                }
              }}
            >
              <IconCopy class="size-3" />
              Copy URL
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                selectedHeartbeatMonitor = monitor;
                queueMicrotask(() => (isPauseDialogOpen = true));
              }}
            >
              {#if monitor.isPaused}
                <IconPlayerPlay />
                Resume
              {:else}
                <IconPlayerPause class="size-3" />
                Pause
              {/if}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                selectedHeartbeatMonitor = monitor;
                queueMicrotask(() => (isEditModalOpen = true));
              }}
            >
              <IconPencilMinus class="size-3" />
              Edit
            </DropdownMenu.Item>
            <DropdownMenu.Item
              variant="destructive"
              onSelect={() => {
                selectedHeartbeatMonitor = monitor;
                queueMicrotask(() => (isDeleteDialogOpen = true));
              }}
            >
              <IconTrash class="size-3" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    {:else}
      <div class="flex flex-col items-center text-muted-foreground pt-[5%]">
        No heartbeat monitors found.
      </div>
    {/each}
  </Card.Root>
{/snippet}

{#if selectedHeartbeatMonitor}
  <DeleteHeartbeatMonitorDialog
    bind:open={isDeleteDialogOpen}
    heartbeatMonitor={selectedHeartbeatMonitor}
  />
  <CreateEditHeartbeatMonitor
    bind:open={isEditModalOpen}
    heartbeatMonitor={selectedHeartbeatMonitor}
    destinations={data.destinations}
  />
  <ToggleHeartbeatMonitorPausedDialog
    bind:open={isPauseDialogOpen}
    heartbeatMonitor={selectedHeartbeatMonitor}
  />
{/if}
