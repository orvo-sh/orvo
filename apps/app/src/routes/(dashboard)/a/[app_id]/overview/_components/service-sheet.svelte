<script lang="ts">
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import * as ScrollArea from "@repo/components/ui/scroll-area";
  import { formatNumber } from "@repo/utils";
  import {
    IconAlertTriangle,
    IconArrowUpRight,
    IconChartBar,
    IconRoute,
    IconX,
  } from "@tabler/icons-svelte";

  let {
    service,
    incomingServices,
    outgoingServices,
    time,
    onClose,
  }: {
    service: {
      name: string;
      total: number;
      errors: number;
      errorRate: number;
      p95LatencyMs: number;
      severity: "critical" | "warning" | "info";
      buckets: number[];
    };
    incomingServices: Array<{
      name: string;
      total: number;
      errors: number;
      errorRate: number;
    }>;
    outgoingServices: Array<{
      name: string;
      total: number;
      errors: number;
      errorRate: number;
    }>;
    time: "30m" | "1h" | "4h" | "24h" | "7d";
    onClose: () => void;
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

  const serviceMapHref = $derived(
    `/a/${page.params.app_id}/service-map?t=${encodeURIComponent(timePreset)}&service=${encodeURIComponent(service.name)}`,
  );

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

  const buildSparklinePath = (buckets: number[]) => {
    if (buckets.length === 0) {
      return "";
    }

    const max = Math.max(...buckets, 1);
    const min = Math.min(...buckets);
    const range = max - min || 1;
    const width = 280;
    const height = 72;
    const step = width / (buckets.length - 1 || 1);

    return buckets
      .map((value, index) => {
        const x = index * step;
        const y = height - ((value - min) / range) * height;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  const formatThroughput = (value: number) => {
    const perSecond = value / timeSeconds;
    if (perSecond >= 1000) {
      return `${(perSecond / 1000).toFixed(1)}k/s`;
    }

    return `${perSecond.toFixed(1)}/s`;
  };

  const formatLatency = (value: number) =>
    value > 0 ? `${Math.round(value)} ms` : "—";

  const formatCalls = (value: number) => {
    const perSecond = value / timeSeconds;
    if (perSecond >= 1000) {
      return `${(perSecond / 1000).toFixed(1)}k/s`;
    }

    return `${perSecond.toFixed(1)}/s`;
  };

  const severityMeta = $derived(
    {
      critical: {
        label: "Needs attention",
        dotClass: "bg-red-500/80",
        badgeVariant: "destructive" as const,
      },
      warning: {
        label: "Elevated latency",
        dotClass: "bg-amber-500/80",
        badgeVariant: "secondary" as const,
      },
      info: {
        label: "Healthy",
        dotClass: "bg-muted-foreground/70",
        badgeVariant: "outline" as const,
      },
    }[service.severity],
  );
</script>

<div class="flex h-full min-h-0 flex-col">
  <div class="flex h-13 shrink-0 items-center justify-between border-b px-4">
    <div class="min-w-0">
      <p class="text-sm font-semibold tracking-tight text-foreground">
        {service.name}
      </p>
      <div class="mt-1 flex items-center gap-2">
        <span
          class={cn("size-2 rounded-full", severityMeta.dotClass)}
        ></span>
        <Badge variant={severityMeta.badgeVariant}>
          {severityMeta.label}
        </Badge>
      </div>
    </div>
    <Button
      variant="ghost"
      size="icon-sm"
      onclick={onClose}
      aria-label="Close service details"
    >
      <IconX data-slot="button-icon" />
    </Button>
  </div>

  <ScrollArea.Root class="min-h-0 flex-1">
    <div class="space-y-4 p-4">
      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-xl border bg-card p-3">
          <p class="text-xs text-muted-foreground">Throughput</p>
          <p class="mt-1 text-base font-semibold tabular-nums text-foreground">
            {formatThroughput(service.total)}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            {formatNumber(service.total)} traces in range
          </p>
        </div>

        <div class="rounded-xl border bg-card p-3">
          <p class="text-xs text-muted-foreground">p95 latency</p>
          <p class="mt-1 text-base font-semibold tabular-nums text-foreground">
            {formatLatency(service.p95LatencyMs)}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            95th percentile duration
          </p>
        </div>

        <div class="rounded-xl border bg-card p-3">
          <div class="flex items-center gap-1.5 text-muted-foreground">
            <IconAlertTriangle class="size-3.5" />
            <p class="text-xs">Errors</p>
          </div>
          <p class="mt-1 text-base font-semibold tabular-nums text-foreground">
            {formatNumber(service.errors)}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            {(service.errorRate * 100).toFixed(1)}% error rate
          </p>
        </div>

        <div class="rounded-xl border bg-card p-3">
          <div class="flex items-center gap-1.5 text-muted-foreground">
            <IconRoute class="size-3.5" />
            <p class="text-xs">Window</p>
          </div>
          <p class="mt-1 text-base font-semibold tabular-nums text-foreground">
            last {time}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            Same range as overview
          </p>
        </div>
      </div>

      <div class="rounded-xl border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Recent activity</p>
            <p class="text-xs text-muted-foreground">
              Throughput trend for this service
            </p>
          </div>
          <IconChartBar class="size-4 text-muted-foreground" />
        </div>

        <div class="mt-4 rounded-lg border bg-muted/30 p-3">
          <svg
            viewBox="0 0 280 72"
            class="h-24 w-full"
            preserveAspectRatio="none"
          >
            <path
              d={buildSparklinePath(service.buckets)}
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-foreground"
            />
          </svg>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-xl border bg-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-foreground">Incoming</p>
              <p class="text-xs text-muted-foreground">
                Services calling {service.name}
              </p>
            </div>
            <Badge variant="outline">{incomingServices.length}</Badge>
          </div>

          <div class="mt-4 space-y-2">
            {#if incomingServices.length === 0}
              <p class="text-sm text-muted-foreground">
                No inbound service calls in this window.
              </p>
            {:else}
              {#each incomingServices as item}
                <div class="rounded-lg border bg-background p-3">
                  <div class="flex items-center justify-between gap-3">
                    <p class="truncate text-sm font-medium text-foreground">
                      {item.name}
                    </p>
                    <span class="text-xs tabular-nums text-muted-foreground">
                      {formatCalls(item.total)}
                    </span>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {formatNumber(item.errors)} errors ·
                    {(item.errorRate * 100).toFixed(1)}% failure rate
                  </p>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <div class="rounded-xl border bg-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-foreground">Outgoing</p>
              <p class="text-xs text-muted-foreground">
                Services called by {service.name}
              </p>
            </div>
            <Badge variant="outline">{outgoingServices.length}</Badge>
          </div>

          <div class="mt-4 space-y-2">
            {#if outgoingServices.length === 0}
              <p class="text-sm text-muted-foreground">
                No outbound service calls in this window.
              </p>
            {:else}
              {#each outgoingServices as item}
                <div class="rounded-lg border bg-background p-3">
                  <div class="flex items-center justify-between gap-3">
                    <p class="truncate text-sm font-medium text-foreground">
                      {item.name}
                    </p>
                    <span class="text-xs tabular-nums text-muted-foreground">
                      {formatCalls(item.total)}
                    </span>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {formatNumber(item.errors)} errors ·
                    {(item.errorRate * 100).toFixed(1)}% failure rate
                  </p>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <div class="rounded-xl border bg-card p-4">
        <p class="text-sm font-medium text-foreground">Next step</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Open the full service map to inspect upstream and downstream calls for
          {` ${service.name}`}.
        </p>
        <Button class="mt-4 w-full justify-between" href={serviceMapHref}>
          Open service map
          <IconArrowUpRight data-slot="button-icon" />
        </Button>
      </div>
    </div>
  </ScrollArea.Root>
</div>
