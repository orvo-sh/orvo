<script lang="ts">
  import { cn } from "@repo/components";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "@repo/components/ui/card";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { Progress } from "@repo/components/ui/progress";
  import { formatBytes } from "@repo/utils";
  import { IconInfoCircle as InfoCircleIcon } from "@tabler/icons-svelte";

  let {
    plan,
    billingHref,
  }: {
    plan: {
      billingPlan: string | null;
      includedBytes: number;
      usedBytes: number;
      logsIngestedBytes: number;
      metricsIngestedBytes: number;
      tracesIngestedBytes: number;
      usagePercent: number;
    } | null;
    billingHref: string;
  } = $props();

  const ctaLabel = $derived(
    plan?.billingPlan === "starter" ? "Upgrade plan" : "Manage plan",
  );
</script>

{#if plan}
  <div class="p-2 pb-0">
    <Card size="sm" class="gap-1.5! rounded-lg py-2!">
      <CardHeader class="gap-2 px-2!">
        <div class="flex items-center justify-between gap-2">
          <CardTitle class="text-sm tracking-tight">Included ingest</CardTitle>
          <HoverCard.Root>
            <HoverCard.Trigger
              aria-label="What is included ingest?"
              class={buttonVariants({
                variant: "ghost",
                size: "icon",
                class: "size-5",
              })}
            >
              <InfoCircleIcon class="size-4 text-muted-foreground" />
            </HoverCard.Trigger>
            <HoverCard.Content class="w-64 text-sm" side="top" align="end">
              <div class="space-y-2">
                <p>Monthly ingest across logs, metrics, and traces.</p>
                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span class="text-muted-foreground">Logs</span>
                  <span class="text-right tabular-nums">
                    {formatBytes(plan.logsIngestedBytes, "GB")}
                  </span>
                  <span class="text-muted-foreground">Metrics</span>
                  <span class="text-right tabular-nums">
                    {formatBytes(plan.metricsIngestedBytes, "GB")}
                  </span>
                  <span class="text-muted-foreground">Traces</span>
                  <span class="text-right tabular-nums">
                    {formatBytes(plan.tracesIngestedBytes, "GB")}
                  </span>
                </div>
              </div>
            </HoverCard.Content>
          </HoverCard.Root>
        </div>
      </CardHeader>

      <CardContent class="grid gap-2 px-2!">
        {@const percentage = Math.round(
          (plan.usedBytes / plan.includedBytes) * 100,
        )}
        <Progress
          value={percentage}
          class={cn(
            "h-1.5 bg-muted/80",
            (() => {
              if (percentage >= 90) return "*:bg-destructive";
              if (percentage >= 70) return "*:bg-amber-500";
              return "*:bg-primary";
            })(),
          )}
        />

        <div class="space-y-0.5">
          <p class="text-sm font-normal text-secondary-foreground tabular-nums">
            {formatBytes(plan.usedBytes, "GB")} of {formatBytes(
              plan.includedBytes,
              "GB",
            )} used
          </p>
        </div>

        <Button
          href={billingHref}
          variant="outline"
          size="sm"
          class="mt-2 w-full text-sm"
        >
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  </div>
{/if}
