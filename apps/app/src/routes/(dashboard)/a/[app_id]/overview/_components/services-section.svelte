<script lang="ts">
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as Table from "@repo/components/ui/table";
  import { formatNumber } from "@repo/utils";
  import {
    IconArrowDown,
    IconArrowUp,
    IconChevronRight,
  } from "@tabler/icons-svelte";

  type ServiceRow = {
    name: string;
    total: number;
    errors: number;
    errorRate: number;
    p95LatencyMs: number;
    severity: "critical" | "warning" | "info";
    buckets: number[];
  };

  let {
    services,
    time,
    loading = false,
  }: {
    services: ServiceRow[];
    time: "30m" | "1h" | "4h" | "24h" | "7d";
    loading?: boolean;
  } = $props();

  const timePreset = $derived(
    (
      {
        "30m": "last_30_minutes",
        "1h": "last_hour",
        "4h": "last_4_hours",
        "24h": "last_24_hours",
        "7d": "last_7_days",
      } as const
    )[time],
  );

  const viewAllHref = $derived(
    `/a/${page.params.app_id}/service-map?t=${encodeURIComponent(timePreset)}`,
  );

  const getServiceHref = (serviceName: string) =>
    `/a/${page.params.app_id}/service-map?t=${encodeURIComponent(timePreset)}&service=${encodeURIComponent(serviceName)}`;

  const formatLatency = (value: number) => {
    if (value <= 0) {
      return "—";
    }

    return `${Math.round(value)} ms`;
  };

  const timeSeconds = $derived(
    (
      {
        "30m": 1800,
        "1h": 3600,
        "4h": 14400,
        "24h": 86400,
        "7d": 604800,
      } as const
    )[time],
  );

  const formatThroughput = (value: number) => {
    const perSecond = value / timeSeconds;
    if (perSecond >= 1000) {
      return `${(perSecond / 1000).toFixed(1)}k/s`;
    }

    return `${perSecond.toFixed(1)}/s`;
  };

  const formatErrors = (value: number) => {
    if (value > 0) {
      return `+${formatNumber(value)}`;
    }

    return `${value}`;
  };

  function getP95TrendClass(service: ServiceRow) {
    if (service.p95LatencyMs <= 0) {
      return "text-muted-foreground";
    }

    if (service.severity === "critical" || service.severity === "warning") {
      return "text-amber-600";
    }

    return "text-green-600";
  }

  function getP95Arrow(service: ServiceRow) {
    if (service.p95LatencyMs <= 0) {
      return null;
    }

    if (service.severity === "critical" || service.severity === "warning") {
      return IconArrowUp;
    }

    return IconArrowDown;
  }

  function buildSparklinePath(buckets: number[]) {
    if (buckets.length === 0) {
      return "";
    }

    const max = Math.max(...buckets, 1);
    const min = Math.min(...buckets);
    const range = max - min || 1;
    const width = 60;
    const height = 20;
    const step = width / (buckets.length - 1 || 1);

    return buckets
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }
</script>

<section class="flex flex-col">
  <div class="flex items-center justify-between">
    <div class="flex flex-1 items-center gap-0 px-3 py-0.5">
      <h2 class="text-sm font-normal tracking-tight text-secondary-foreground">
        Services
      </h2>
    </div>
    <Button
      variant="ghost"
      class="gap-1 text-secondary-foreground"
      disabled={loading}
      href={viewAllHref}
    >
      View all
      <IconChevronRight />
    </Button>
  </div>

  <Card.Root class="relative bg-secondary p-0">
    {#if loading}
      <div
        class="absolute top-0 z-50 h-full w-full bg-background opacity-60"
      ></div>
    {/if}
    <Card.Content class="p-0">
      {#if services.length === 0}
        <div
          class="flex items-center justify-center py-8 text-sm text-muted-foreground"
        >
          No services found.
        </div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row class="hover:bg-transparent">
              <Table.Head class="pl-4">Service</Table.Head>
              <Table.Head>Throughput</Table.Head>
              <Table.Head>Errors</Table.Head>
              <Table.Head>Rate</Table.Head>
              <Table.Head class="pr-4">P95</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each services as service (service.name)}
              <Table.Row
                class="cursor-pointer"
                role="link"
                tabindex={0}
                onclick={() => {
                  window.location.href = getServiceHref(service.name);
                }}
                onkeydown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    window.location.href = getServiceHref(service.name);
                  }
                }}
              >
                <Table.Cell class="pl-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class={cn(
                          "size-2 rounded-full",
                          {
                            info: "bg-muted-foreground/60",
                            warning: "bg-amber-500/60",
                            critical: "bg-red-500/60",
                          }[service.severity],
                        )}
                      ></span>
                      <p class="truncate text-sm font-medium text-foreground">
                        {service.name}
                      </p>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium tabular-nums">
                      {formatThroughput(service.total)}
                    </span>
                    <svg
                      viewBox="0 0 60 20"
                      class="h-5 w-[60px]"
                      preserveAspectRatio="none"
                    >
                      <path
                        d={buildSparklinePath(service.buckets)}
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        class="text-muted-foreground/60"
                      />
                    </svg>
                  </div>
                </Table.Cell>
                <Table.Cell class="text-sm font-medium tabular-nums">
                  {formatErrors(service.errors)}
                </Table.Cell>
                <Table.Cell class="text-sm tabular-nums">
                  {(service.errorRate * 100).toFixed(1)}%
                </Table.Cell>
                <Table.Cell class="pr-4">
                  <div class="flex items-center gap-1">
                    <span class="text-sm font-medium tabular-nums">
                      {formatLatency(service.p95LatencyMs)}
                    </span>
                    {#if service.p95LatencyMs > 0}
                      {@const Arrow = getP95Arrow(service)}
                      <span class={getP95TrendClass(service)}>
                        <Arrow class="size-3" />
                      </span>
                    {/if}
                  </div>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>
</section>
