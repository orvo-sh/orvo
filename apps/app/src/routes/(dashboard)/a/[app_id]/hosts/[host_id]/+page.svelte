<script lang="ts">
  import { page } from "$app/state";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as Table from "@repo/components/ui/table";
  import { formatNumber } from "@repo/utils";
  import {
    IconArrowLeft,
    IconBox,
    IconDatabase,
    IconServer,
  } from "@tabler/icons-svelte";
  import PageContainer from "../../_components/page-container/page-container.svelte";
  import MetricsTimeseriesChart from "../../metrics/_components/metrics-timeseries-chart.svelte";

  let { data } = $props();

  const result = $derived(data.hostDetailResult);
  type EntityStatus = "healthy" | "stale" | "alerting";
  const statusClasses = {
    healthy:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
    stale:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    alerting: "border-destructive/30 bg-destructive/10 text-destructive",
  } as const;

  const formatPercent = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(value >= 10 ? 0 : 1)}%`;

  const formatBytes = (value: number | null) => {
    if (value === null) {
      return "—";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let index = 0;

    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }

    return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  };
</script>

<PageContainer title={result.success ? result.data.host.hostName : "Host"}>
  {#snippet actions()}
    <Button href={`/a/${page.params.app_id}/hosts`} variant="outline">
      <IconArrowLeft data-slot="button-icon" />
      Back to hosts
    </Button>
  {/snippet}

  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    {#if !result.success}
      <div
        class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {result.error}
      </div>
    {:else}
      <section
        class="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,0.7fr))]"
      >
        <div class="rounded-xl border bg-background p-5">
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium">{result.data.host.hostName}</p>
                <Badge
                  variant="outline"
                  class={statusClasses[result.data.host.status]}
                >
                  {result.data.host.status}
                </Badge>
              </div>
              <p class="text-sm text-muted-foreground">
                {result.data.host.osType ?? "Unknown OS"}{result.data.host
                  .hostArch
                  ? ` · ${result.data.host.hostArch}`
                  : ""} · {result.data.host.hostId}
              </p>
            </div>
            <div class="rounded-lg border bg-muted/40 p-2">
              <IconServer class="size-5 text-muted-foreground" />
            </div>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border px-3 py-2">
              <p class="text-xs text-muted-foreground">Last seen</p>
              <p class="mt-1 text-sm font-medium">
                {new Date(result.data.host.lastSeen).toLocaleString()}
              </p>
            </div>
            <div class="rounded-lg border px-3 py-2">
              <p class="text-xs text-muted-foreground">Open incident</p>
              <p class="mt-1 text-sm font-medium">
                {result.data.host.openIncident?.id ?? "None"}
              </p>
            </div>
          </div>
        </div>

        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-xs text-muted-foreground">CPU</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">
            {formatPercent(result.data.host.cpuUtilization)}
          </p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-xs text-muted-foreground">Memory</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">
            {formatPercent(result.data.host.memoryUtilization)}
          </p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-xs text-muted-foreground">Filesystem</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">
            {formatPercent(result.data.host.filesystemUtilization)}
          </p>
        </div>
        <div class="rounded-xl border bg-background px-4 py-3">
          <p class="text-xs text-muted-foreground">Load average</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">
            {result.data.host.load1m === null
              ? "—"
              : formatNumber(result.data.host.load1m)}
          </p>
        </div>
      </section>

      <section class="grid gap-3 xl:grid-cols-3">
        {#each result.data.series as series}
          <MetricsTimeseriesChart
            title={series.label}
            description={`${series.label} trend for this host over the last hour.`}
            series={[
              {
                name: result.data.host.hostName,
                points: series.points,
                buckets: series.buckets,
              },
            ]}
            aggregation="avg"
            unit="%"
          />
        {/each}
      </section>

      <section
        class="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]"
      >
        <div class="overflow-hidden rounded-xl border bg-background">
          <div class="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p class="text-sm font-medium">Containers</p>
              <p class="text-xs text-muted-foreground">
                Containers currently reporting from this host.
              </p>
            </div>
            <Badge variant="outline">
              <IconBox class="mr-1 size-3.5" />
              {result.data.containers.length}
            </Badge>
          </div>

          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Name</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>CPU</Table.Head>
                <Table.Head>Memory</Table.Head>
                <Table.Head>Image</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each result.data.containers as container (container.containerId)}
                <Table.Row>
                  <Table.Cell>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium">
                        {container.containerName}
                      </p>
                      <p class="truncate text-xs text-muted-foreground">
                        {container.containerId}
                      </p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      variant="outline"
                      class={statusClasses[container.status as EntityStatus]}
                    >
                      {container.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell class="tabular-nums"
                    >{formatPercent(container.cpuUtilization)}</Table.Cell
                  >
                  <Table.Cell class="tabular-nums">
                    {formatPercent(container.memoryUtilization)}
                    <div class="text-xs text-muted-foreground">
                      {formatBytes(container.memoryUsageBytes)} / {formatBytes(
                        container.memoryLimitBytes,
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell class="max-w-64 truncate text-muted-foreground">
                    {container.containerImageName ?? "—"}
                  </Table.Cell>
                </Table.Row>
              {:else}
                <Table.Row>
                  <Table.Cell
                    colspan={5}
                    class="py-8 text-center text-sm text-muted-foreground"
                  >
                    No containers are reporting from this host.
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>

        <div class="overflow-hidden rounded-xl border bg-background">
          <div class="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p class="text-sm font-medium">Filesystem mounts</p>
              <p class="text-xs text-muted-foreground">
                Highest utilization mounts for this host.
              </p>
            </div>
            <Badge variant="outline">
              <IconDatabase class="mr-1 size-3.5" />
              {result.data.filesystems.length}
            </Badge>
          </div>

          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mountpoint</Table.Head>
                <Table.Head>Utilization</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each result.data.filesystems as filesystem (filesystem.mountpoint)}
                <Table.Row>
                  <Table.Cell class="font-medium"
                    >{filesystem.mountpoint}</Table.Cell
                  >
                  <Table.Cell class="tabular-nums"
                    >{formatPercent(filesystem.utilization)}</Table.Cell
                  >
                </Table.Row>
              {:else}
                <Table.Row>
                  <Table.Cell
                    colspan={2}
                    class="py-8 text-center text-sm text-muted-foreground"
                  >
                    No filesystem utilization samples are available.
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      </section>
    {/if}
  </div>
</PageContainer>
