<script lang="ts">
  import { cn } from "@repo/components";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import {
    IconAlertTriangle,
    IconChartBar,
    IconChevronRight,
    IconClock,
    IconGitCommit,
    IconInfoCircle,
    IconSparkles,
    IconTrendingDown,
    IconTrendingUp,
  } from "@tabler/icons-svelte";

  type InsightItem = {
    id: string;
    title: string;
    body: string;
    severity: "critical" | "warning" | "info";
    category: string;
    score: number;
    serviceName?: string;
    link?: string;
  };

  let {
    insights,
    loading = false,
    onViewAll,
  }: {
    insights: InsightItem[];
    loading?: boolean;
    onViewAll: () => void;
  } = $props();

  const limit = 3;
  const visible = $derived(insights.slice(0, limit));
  const hasMore = $derived(insights.length > limit);

  function getIcon(category: string, severity: string) {
    if (category === "error_spike" || category === "active_alert") {
      return IconAlertTriangle;
    }
    if (category === "latency_regression") {
      return IconClock;
    }
    if (category === "throughput_drop") {
      return IconTrendingDown;
    }
    if (category === "new_error_pattern") {
      return IconSparkles;
    }
    if (category === "deployment_impact") {
      return IconGitCommit;
    }
    if (category === "metric_anomaly") {
      return IconChartBar;
    }
    if (severity === "info") {
      return IconTrendingUp;
    }
    return IconSparkles;
  }

  function getIconStyles(severity: string) {
    if (severity === "critical") {
      return "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400";
    }
    if (severity === "warning") {
      return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400";
    }
    return "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400";
  }

  function getBadgeStyles(severity: string) {
    if (severity === "critical") {
      return "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400";
    }
    if (severity === "warning") {
      return "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";
    }
    return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
  }
</script>

<section class="flex flex-col">
  <div class="flex items-center justify-between">
    <div class="flex flex-1 items-center gap-0 px-3 py-0.5">
      <h2 class="text-sm font-normal tracking-tight text-secondary-foreground">
        Top insights
      </h2>
      <HoverCard.Root openDelay={50} closeDelay={50}>
        <HoverCard.Trigger
          class={buttonVariants({
            variant: "ghost",
            size: "icon-sm",
          })}
        >
          <IconInfoCircle
            class="size-3.5 text-secondary-foreground opacity-75"
          />
        </HoverCard.Trigger>
        <HoverCard.Content
          class="max-w-sm min-w-72 text-sm text-secondary-foreground"
        >
          <div class="space-y-2">
            <p>
              Insights help you quickly identify potential issues and understand
              changes in key metrics.
            </p>
            <div class="flex items-start gap-2">
              <span class="mt-1.5 size-2 min-w-2 rounded-full bg-red-500/60"
              ></span>
              <p>
                <span class="font-medium">Critical:</span> a serious issue or outage
                that needs immediate attention.
              </p>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-1.5 size-2 min-w-2 rounded-full bg-amber-500/60"
              ></span>
              <p>
                <span class="font-medium">Warning:</span> a degradation or anomaly
                that should be investigated soon.
              </p>
            </div>
            <div class="flex items-start gap-2">
              <span
                class="mt-1.5 size-2 min-w-2 rounded-full bg-muted-foreground/60"
              ></span>
              <p>
                <span class="font-medium">Info:</span> an informational observation
                or positive trend.
              </p>
            </div>
          </div>
        </HoverCard.Content>
      </HoverCard.Root>
    </div>
    <Button
      variant="ghost"
      class="gap-1 text-secondary-foreground"
      disabled={loading}
      onclick={onViewAll}
    >
      View all
      <IconChevronRight />
    </Button>
  </div>

  <Card.Root class="relative  p-0">
    {#if loading}
      <div
        class="absolute top-0 z-50 h-full w-full bg-background opacity-60"
      ></div>
    {/if}
    <Card.Content class="p-0">
      {#if visible.length === 0}
        <div
          class="flex items-center justify-center py-8 text-sm text-muted-foreground"
        >
          All monitored signals are behaving normally.
        </div>
      {:else}
        <div class="divide-y divide-border">
          {#each visible as insight (insight.id)}
            {#if insight.link}
              <a
                href={insight.link}
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
                        }[insight.severity],
                      )}
                    ></span>
                    <p class="text-sm font-medium">{insight.title}</p>
                  </div>
                  <p class="line-clamp-2 text-xs text-muted-foreground">
                    {insight.body}
                  </p>
                </div>
                <IconChevronRight
                  class="size-4 shrink-0 text-muted-foreground"
                />
              </a>
            {:else}
              <div class="flex items-center gap-3 p-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span
                      class={cn(
                        "size-2 rounded-full",
                        {
                          info: "bg-muted-foreground/60",
                          warning: "bg-amber-500/60",
                          critical: "bg-red-500/60",
                        }[insight.severity],
                      )}
                    ></span>
                    <p class="text-sm font-medium">{insight.title}</p>
                  </div>
                  <p class="line-clamp-2 text-xs text-muted-foreground">
                    {insight.body}
                  </p>
                </div>
                <div class="size-4 shrink-0"></div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</section>
