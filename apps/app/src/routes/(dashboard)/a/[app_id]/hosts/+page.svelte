<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { startAutoRefresh } from "$lib/browser/auto-refresh";
  import { Badge } from "@repo/components/ui/badge";
  import * as Card from "@repo/components/ui/card";
  import * as Table from "@repo/components/ui/table";
  import { IconServer } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  import PageContainer from "../_components/page-container/page-container.svelte";
  import AddHostDialog from "./_components/add-host-dialog.svelte";

  let { data } = $props();

  onMount(() =>
    startAutoRefresh({
      refresh: () => invalidateAll(),
      intervalMs: 10_000,
    }),
  );

  const formatPercent = (value: number | null) =>
    value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(0)}%`;
</script>

<PageContainer title="Hosts" contentClass="p-3">
  {#snippet actions()}
    <AddHostDialog />
  {/snippet}

  {#if data.hosts.length === 0}
    <div class="flex min-h-80 flex-1 items-center justify-center">
      <div class="flex max-w-sm flex-col items-center gap-4 text-center">
        <div class="rounded-xl border bg-muted/40 p-3">
          <IconServer class="size-5 text-muted-foreground" />
        </div>
        <div>
          <p class="text-sm font-medium">Monitor your first host</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Install Orvo Agent on a Linux server to collect CPU, memory, disk,
            filesystem, and network metrics.
          </p>
        </div>
        <AddHostDialog />
      </div>
    </div>
  {:else}
    <Card.Root class="gap-0 overflow-hidden rounded-xl p-0">
      <Table.Root>
        <Table.Header>
          <Table.Row class="hover:bg-transparent">
            <Table.Head>Host</Table.Head>
            <Table.Head>Reporting</Table.Head>
            <Table.Head>CPU</Table.Head>
            <Table.Head>Memory</Table.Head>
            <Table.Head>Disk</Table.Head>
            <Table.Head>Load</Table.Head>
            <Table.Head class="text-right">Last reported</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.hosts as host (host.id)}
            <Table.Row>
              <Table.Cell>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{host.hostName}</p>
                  <p class="truncate text-xs text-muted-foreground">
                    {host.environment} · {host.operatingSystem}/{host.architecture}
                  </p>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge
                  variant="outline"
                  class={host.reporting
                    ? "border-green-600/20 bg-green-600/7 text-green-700"
                    : "border-amber-600/20 bg-amber-600/7 text-amber-800"}
                >
                  {host.reporting
                    ? "Active"
                    : host.lastSeen
                      ? "Not reporting"
                      : "Connecting"}
                </Badge>
              </Table.Cell>
              <Table.Cell class="font-mono text-xs tabular-nums">
                {formatPercent(host.cpuUtilization)}
              </Table.Cell>
              <Table.Cell class="font-mono text-xs tabular-nums">
                {formatPercent(host.memoryUtilization)}
              </Table.Cell>
              <Table.Cell class="font-mono text-xs tabular-nums">
                {formatPercent(host.filesystemUtilization)}
              </Table.Cell>
              <Table.Cell class="font-mono text-xs tabular-nums">
                {host.load1m === null ? "—" : host.load1m.toFixed(2)}
              </Table.Cell>
              <Table.Cell class="text-right text-xs text-muted-foreground">
                {host.lastSeen
                  ? new Date(host.lastSeen).toLocaleString()
                  : "Waiting for data"}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Root>
  {/if}
</PageContainer>
