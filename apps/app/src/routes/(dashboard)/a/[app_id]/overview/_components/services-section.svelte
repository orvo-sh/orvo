<script lang="ts">
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import { formatNumber } from "@repo/utils";
  import { IconChevronRight } from "@tabler/icons-svelte";

  type ServiceRow = {
    name: string;
    total: number;
    errors: number;
    errorRate: number;
    p95LatencyMs: number;
    severity: "critical" | "warning" | "info";
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

  const formatSubtext = (service: ServiceRow) => {
    return [
      `${formatNumber(service.total)} calls`,
      `${formatNumber(service.errors)} errors`,
      `${(service.errorRate * 100).toFixed(1)}%`,
      formatLatency(service.p95LatencyMs),
    ].join(" · ");
  };
</script>

<section class="flex flex-col rounded-xl bg-muted ring ring-foreground/10">
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

  <Card.Root class="relative p-0">
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
        <div class="divide-y divide-border">
          {#each services as service (service.name)}
            <a
              href={getServiceHref(service.name)}
              class="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50"
            >
              <div class="min-w-0 flex-1">
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
                  <p class="text-sm font-medium">{service.name}</p>
                </div>
                <p class="line-clamp-2 text-xs text-muted-foreground">
                  {formatSubtext(service)}
                </p>
              </div>
              <IconChevronRight class="size-4 shrink-0 text-muted-foreground" />
            </a>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</section>
