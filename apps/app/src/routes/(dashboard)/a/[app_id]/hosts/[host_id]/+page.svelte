<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { deleteHostCommand, updateHostCommand } from "$lib/api/agents.remote";
  import { startAutoRefresh } from "$lib/browser/auto-refresh";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as Dialog from "@repo/components/ui/dialog";
  import * as DropdownMenu from "@repo/components/ui/dropdown-menu";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import * as Select from "@repo/components/ui/select";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconActivityHeartbeat,
    IconCpu,
    IconDatabase,
    IconDots,
    IconGauge,
    IconPencil,
    IconServer,
    IconTrash,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  import PageContainer from "../../_components/page-container/page-container.svelte";
  import ChartCard from "../../overview/_components/chart-card.svelte";

  let { data } = $props();
  const timeOptions = ["1h", "4h", "24h", "7d"] as const;

  let loading = $state(false);
  let editOpen = $state(false);
  let deleteOpen = $state(false);
  let saving = $state(false);
  let deleting = $state(false);
  let displayName = $state(data.host.displayName);
  let environment = $state(data.host.environment);

  onMount(() =>
    startAutoRefresh({
      refresh: () => invalidateAll(),
      intervalMs: 10_000,
    }),
  );

  const updateTime = async (time: (typeof timeOptions)[number]) => {
    if (loading || time === data.time) return;
    loading = true;
    try {
      // The route is resolved before its time-range query string is appended.
      /* eslint-disable svelte/no-navigation-without-resolve */
      await goto(
        `${resolve("/(dashboard)/a/[app_id]/hosts/[host_id]", {
          app_id: page.params.app_id!,
          host_id: data.host.id,
        })}?t=${time}`,
      );
      /* eslint-enable svelte/no-navigation-without-resolve */
    } finally {
      loading = false;
    }
  };

  const save = async () => {
    saving = true;
    try {
      const result = await updateHostCommand({
        id: data.host.id,
        displayName,
        environment,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      editOpen = false;
      await invalidateAll();
      toast.success("Host properties updated.");
    } catch {
      toast.error("Failed to update host properties.");
    } finally {
      saving = false;
    }
  };

  const remove = async () => {
    deleting = true;
    try {
      const result = await deleteHostCommand(data.host.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Host deleted.");
      await goto(resolve(`/a/${page.params.app_id}/hosts`));
    } catch {
      toast.error("Failed to delete host.");
    } finally {
      deleting = false;
    }
  };

  const formatPercent = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(0)}%`;

  const cpuData = $derived(
    data.series
      .filter((point) => point.cpuUtilization !== null)
      .map((point) => ({
        timestamp: new Date(point.timestamp),
        value: point.cpuUtilization ?? 0,
      })),
  );
  const memoryData = $derived(
    data.series
      .filter((point) => point.memoryUtilization !== null)
      .map((point) => ({
        timestamp: new Date(point.timestamp),
        value: point.memoryUtilization ?? 0,
      })),
  );
  const filesystemData = $derived(
    data.series
      .filter((point) => point.filesystemUtilization !== null)
      .map((point) => ({
        timestamp: new Date(point.timestamp),
        value: point.filesystemUtilization ?? 0,
      })),
  );
  const loadData = $derived(
    data.series
      .filter((point) => point.load1m !== null)
      .map((point) => ({
        timestamp: new Date(point.timestamp),
        value: point.load1m ?? 0,
      })),
  );
</script>

<PageContainer
  title={data.host.displayName}
  back={{ href: `/a/${page.params.app_id}/hosts`, title: "Hosts" }}
  contentClass="overflow-y-auto p-3"
>
  {#snippet actions()}
    <Select.Root
      type="single"
      value={data.time}
      onValueChange={(value) => {
        if (value) void updateTime(value as (typeof timeOptions)[number]);
      }}
    >
      <Select.Trigger size="sm" class="h-8.5! min-w-20 rounded-lg! sm:hidden">
        last {data.time}
      </Select.Trigger>
      <Select.Content>
        {#each timeOptions as option (option)}
          <Select.Item value={option} label={`last ${option}`} />
        {/each}
      </Select.Content>
    </Select.Root>
    <div class="hidden gap-1 rounded-lg border bg-secondary p-0.75 sm:flex">
      {#each timeOptions as option (option)}
        <Button
          class="h-6"
          variant={data.time === option ? "default" : "ghost"}
          size="sm"
          onclick={() => void updateTime(option)}>{option}</Button
        >
      {/each}
    </div>
    <Button
      variant="outline"
      size="sm"
      onclick={() => {
        displayName = data.host.displayName;
        environment = data.host.environment;
        editOpen = true;
      }}
    >
      <IconPencil data-slot="button-icon" />
      Edit properties
    </Button>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="outline"
            size="icon-sm"
            aria-label="Host actions"
          >
            <IconDots />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item
          variant="destructive"
          onSelect={() => (deleteOpen = true)}
        >
          <IconTrash />
          Delete host
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/snippet}

  <div class="flex flex-col gap-4">
    <section
      class="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-secondary-foreground"
        >
          <IconServer class="size-5" />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="truncate text-base font-semibold">
              {data.host.displayName}
            </h2>
            <Badge
              variant="outline"
              class={data.host.reporting
                ? "border-green-600/20 bg-green-600/7 text-green-700 dark:text-green-400"
                : "border-amber-600/20 bg-amber-600/7 text-amber-800 dark:text-amber-300"}
            >
              <span
                class={`size-1.5 rounded-full ${data.host.reporting ? "bg-green-500" : "bg-amber-500"}`}
              ></span>
              {data.host.reporting
                ? "Active"
                : data.host.lastSeen
                  ? "Not reporting"
                  : "Connecting"}
            </Badge>
            <Badge variant="secondary">{data.host.environment}</Badge>
          </div>
          <p class="mt-1 truncate text-xs text-muted-foreground">
            {data.host.hostName} · {data.host.operatingSystem}/{data.host
              .architecture}
          </p>
        </div>
      </div>
      <div class="text-left sm:text-right">
        <p class="text-xs text-muted-foreground">Last reported</p>
        <p class="mt-0.5 text-sm font-medium tabular-nums">
          {data.host.lastSeen
            ? new Date(data.host.lastSeen).toLocaleString()
            : "Waiting for data"}
        </p>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {#each [{ label: "CPU", value: formatPercent(data.host.cpuUtilization), icon: IconCpu }, { label: "Memory", value: formatPercent(data.host.memoryUtilization), icon: IconActivityHeartbeat }, { label: "Filesystem", value: formatPercent(data.host.filesystemUtilization), icon: IconDatabase }, { label: "Load average", value: data.host.load1m === null ? "—" : data.host.load1m.toFixed(2), icon: IconGauge }] as metric (metric.label)}
        <Card.Root>
          <Card.Content class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm text-muted-foreground">{metric.label}</p>
              <p class="mt-1 text-xl font-semibold tabular-nums">
                {metric.value}
              </p>
            </div>
            <div
              class="flex size-10 items-center justify-center rounded-md bg-muted text-secondary-foreground"
            >
              <metric.icon class="size-4" />
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </section>

    <section class="grid gap-3 lg:grid-cols-2">
      <ChartCard
        title="CPU utilization"
        data={cpuData}
        summaryValue={data.host.cpuUtilization}
        valueFormatter={(value) => `${value.toFixed(0)}%`}
        yFormat={(value) => `${value.toFixed(0)}%`}
        yDomain={[0, 100]}
        {loading}
      />
      <ChartCard
        title="Memory utilization"
        data={memoryData}
        color="var(--color-chart-2)"
        summaryValue={data.host.memoryUtilization}
        valueFormatter={(value) => `${value.toFixed(0)}%`}
        yFormat={(value) => `${value.toFixed(0)}%`}
        yDomain={[0, 100]}
        {loading}
      />
      <ChartCard
        title="Filesystem utilization"
        data={filesystemData}
        color="var(--color-chart-3)"
        summaryValue={data.host.filesystemUtilization}
        valueFormatter={(value) => `${value.toFixed(0)}%`}
        yFormat={(value) => `${value.toFixed(0)}%`}
        yDomain={[0, 100]}
        {loading}
      />
      <ChartCard
        title="1 minute load average"
        data={loadData}
        color="var(--color-chart-4)"
        summaryValue={data.host.load1m}
        valueFormatter={(value) => value.toFixed(2)}
        yFormat={(value) => value.toFixed(1)}
        yDomain={[0, null]}
        {loading}
      />
    </section>

    <section class="flex flex-col">
      <div
        class="flex translate-y-2 items-center rounded-t-xl border border-foreground/10 bg-secondary px-3.5 pt-1 pb-3 inset-shadow-[0px_1px_--theme(--color-white)]"
      >
        <h2 class="text-sm text-secondary-foreground">Host details</h2>
      </div>
      <Card.Root class="z-1 gap-0 p-0">
        <Card.Content class="grid gap-0 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {#each [["Display name", data.host.displayName], ["Environment", data.host.environment], ["System hostname", data.host.hostName], ["Host ID", data.host.hostId], ["Operating system", data.host.operatingSystem], ["Architecture", data.host.architecture], ["Agent version", data.host.agentVersion], ["Installed", new Date(data.host.installedAt).toLocaleString()], ["Reported environment", data.host.reportedEnvironment ?? "—"]] as detail (detail[0])}
            <div class="min-w-0 border-b p-4 sm:border-r">
              <p class="text-xs text-muted-foreground">{detail[0]}</p>
              <p class="mt-1 truncate font-mono text-xs" title={detail[1]}>
                {detail[1]}
              </p>
            </div>
          {/each}
        </Card.Content>
      </Card.Root>
    </section>
  </div>
</PageContainer>

<Dialog.Root bind:open={editOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Edit host properties</Dialog.Title>
      <Dialog.Description>
        Change how this host is identified inside Orvo.
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4">
      <div class="grid gap-2">
        <Label for="host-display-name">Display name</Label>
        <Input id="host-display-name" bind:value={displayName} />
      </div>
      <div class="grid gap-2">
        <Label for="host-environment">Environment</Label>
        <Input id="host-environment" bind:value={environment} />
        <p class="text-xs text-muted-foreground">
          This changes the host property in Orvo, not the installed agent
          configuration.
        </p>
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (editOpen = false)}
        >Cancel</Button
      >
      <Button
        loading={saving}
        disabled={!displayName.trim() || !environment.trim()}
        onclick={save}>Save changes</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={deleteOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete {data.host.displayName}?</AlertDialog.Title>
      <AlertDialog.Description>
        This revokes the host's ingestion key and removes it from Hosts. The
        agent must be enrolled again to report to Orvo. Existing telemetry
        remains until its normal retention period ends.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        variant="destructive"
        disabled={deleting}
        onclick={remove}
      >
        Delete host
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
