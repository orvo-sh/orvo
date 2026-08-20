<script lang="ts">
  import { PLANS } from "$lib/constants";
  import { cn } from "@repo/components";
  import { buttonVariants } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import * as HoverCard from "@repo/components/ui/hover-card";
  import { Progress } from "@repo/components/ui/progress";
  import { formatBytes } from "@repo/utils";
  import { IconInfoCircle as InfoCircleIcon } from "@tabler/icons-svelte";

  let {
    logsIngestedBytes,
    tracesIngestedBytes,
    metricsIngestedBytes,
    includedBytes,
    chatCreditsUsed,
    chatCreditsIncluded,
  }: {
    logsIngestedBytes: number;
    tracesIngestedBytes: number;
    metricsIngestedBytes: number;
    includedBytes: number;
    chatCreditsUsed: number;
    chatCreditsIncluded: number;
  } = $props();

  const totalIngestedBytes = $derived(
    logsIngestedBytes + tracesIngestedBytes + metricsIngestedBytes,
  );
  const ingestOverageBytes = $derived(
    Math.max(0, totalIngestedBytes - includedBytes),
  );
  const scoutOverageCredits = $derived(
    Math.max(0, chatCreditsUsed - chatCreditsIncluded),
  );
</script>

<div class="p-2 pb-0">
  <Card.Root size="sm" class="gap-1.5! rounded-lg py-2! shadow-xs">
    <Card.Header class="gap-2 px-2!">
      <div class="flex items-center justify-between gap-2">
        <Card.Title class="text-sm tracking-tight">Usage</Card.Title>
        <HoverCard.Root>
          <HoverCard.Trigger
            aria-label="What is included ingest?"
            class={buttonVariants({
              variant: "ghost",
              size: "icon",
              class: "size-4 cursor-help",
            })}
          >
            <InfoCircleIcon class="size-4 text-muted-foreground" />
          </HoverCard.Trigger>
          <HoverCard.Content class="w-64 text-sm" side="top" align="center">
            <div class="space-y-2">
              <p>Monthly ingest across logs, metrics, and traces.</p>
              <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <span class="text-muted-foreground">Logs</span>
                <span class="text-right tabular-nums">
                  {formatBytes(logsIngestedBytes, "GB")}
                </span>
                <span class="text-muted-foreground">Metrics</span>
                <span class="text-right tabular-nums">
                  {formatBytes(metricsIngestedBytes, "GB")}
                </span>
                <span class="text-muted-foreground">Traces</span>
                <span class="text-right tabular-nums">
                  {formatBytes(tracesIngestedBytes, "GB")}
                </span>
              </div>
            </div>
          </HoverCard.Content>
        </HoverCard.Root>
      </div>
    </Card.Header>

    <Card.Content class="grid gap-2 px-2!">
      {@const percentage =
        includedBytes > 0 ? (totalIngestedBytes / includedBytes) * 100 : 0}
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
          {formatBytes(totalIngestedBytes, "GB")}
          of {formatBytes(includedBytes, "GB")} used
        </p>
        {#if ingestOverageBytes > 0}
          <p class="text-xs text-destructive tabular-nums">
            {formatBytes(ingestOverageBytes, "GB")} overage · approximately ${(
              (ingestOverageBytes / Math.pow(1024, 3)) *
              PLANS.pro.overagePricePerGb
            ).toFixed(2)}
          </p>
        {/if}
      </div>

      {#if chatCreditsIncluded > 0}
        {@const chatPercentage = Math.min(
          100,
          (chatCreditsUsed / chatCreditsIncluded) * 100,
        )}
        <div class="mt-1 border-t pt-2">
          <div class="mb-1.5 flex items-center justify-between gap-2 text-sm">
            <span class="text-muted-foreground">Scout</span>
            <span class="text-secondary-foreground tabular-nums">
              {chatCreditsUsed.toLocaleString()} of {chatCreditsIncluded.toLocaleString()}
            </span>
          </div>
          <Progress
            value={chatPercentage}
            class={cn(
              "h-1.5 bg-muted/80",
              chatPercentage >= 90
                ? "*:bg-destructive"
                : chatPercentage >= 70
                  ? "*:bg-amber-500"
                  : "*:bg-primary",
            )}
          />
          {#if scoutOverageCredits > 0}
            <p class="mt-1 text-xs text-destructive tabular-nums">
              {scoutOverageCredits.toLocaleString()} overage · approximately ${(
                (scoutOverageCredits / 1_000_000) *
                PLANS.pro.scoutOveragePricePerMillionCredits
              ).toFixed(2)}
            </p>
          {/if}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
