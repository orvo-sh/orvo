<script lang="ts">
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import {
      Card,
      CardContent,
      CardDescription,
      CardHeader,
      CardTitle,
  } from "@repo/components/ui/card";
  import { Progress } from "@repo/components/ui/progress";
  import {
      IconAlertTriangle,
      IconChartPie2,
      IconDatabase,
  } from "@tabler/icons-svelte";
  import PageContainer from "../_components/page-container/page-container.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const billingState = $derived(data.billingState);
  const allowance = $derived(billingState?.allowance);
  const usageItems = $derived(billingState?.usage ?? []);
  const isOverLimit = $derived((allowance?.overageBytes ?? 0) > 0);

  const formatBytes = (bytes: number | null | undefined) => {
    const value = bytes ?? 0;
    if (value >= 1_000_000_000_000) {
      return `${(value / 1_000_000_000_000).toFixed(2)} TB`;
    }

    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)} GB`;
    }

    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)} MB`;
    }

    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)} KB`;
    }

    return `${value} B`;
  };

  const formatDate = (value: Date | string | null | undefined) => {
    if (!value) return "Not available";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  };

  const formatSignal = (signal: string) =>
    signal.charAt(0).toUpperCase() + signal.slice(1);
</script>

<PageContainer title="Usage" innerClass="gap-5">
  {#snippet helper()}
    <p>
      Usage shows the current billing period ingest compared with the allowance
      configured for the active organization.
    </p>
  {/snippet}

  {#if data.error}
    <div
      class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {data.error}
    </div>
  {:else if billingState && allowance}
    <div class="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
      <Card class="border-border/80">
        <CardHeader class="gap-2 border-b">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="grid gap-1">
              <CardTitle>Organization allowance</CardTitle>
              <CardDescription>
                Current period usage against the ingest limit for this
                organization.
              </CardDescription>
            </div>
            {#if isOverLimit}
              <Badge variant="destructive">
                <IconAlertTriangle data-icon="inline-start" />
                Over limit
              </Badge>
            {:else}
              <Badge variant="secondary">Within allowance</Badge>
            {/if}
          </div>
        </CardHeader>
        <CardContent class="grid gap-5">
          <div class="grid gap-3">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="text-2xl font-semibold tracking-tight text-foreground">
                  {formatBytes(allowance.usedBytes)}
                </p>
                <p class="text-sm text-muted-foreground">
                  of {formatBytes(allowance.includedBytes)} allowed
                </p>
              </div>
              <div class="text-right">
                <p class="text-lg font-medium text-foreground">
                  {allowance.usagePercent}%
                </p>
                <p class="text-sm text-muted-foreground">used</p>
              </div>
            </div>
            <Progress value={allowance.usagePercent} class="h-2" />
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-border/80 bg-muted/30 p-3">
              <p class="text-sm text-muted-foreground">Remaining</p>
              <p class="mt-1 text-base font-medium text-foreground">
                {formatBytes(
                  Math.max(allowance.includedBytes - allowance.usedBytes, 0),
                )}
              </p>
            </div>
            <div class="rounded-lg border border-border/80 bg-muted/30 p-3">
              <p class="text-sm text-muted-foreground">Overage</p>
              <p class="mt-1 text-base font-medium text-foreground">
                {formatBytes(allowance.overageBytes)}
              </p>
            </div>
            <div class="rounded-lg border border-border/80 bg-muted/30 p-3">
              <p class="text-sm text-muted-foreground">Plan</p>
              <p class="mt-1 text-base font-medium capitalize text-foreground">
                {billingState.entitlements.planKey}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="border-border/80">
        <CardHeader class="gap-1 border-b">
          <CardTitle>Current period</CardTitle>
          <CardDescription>
            The active window used for usage tracking.
          </CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div class="grid gap-3">
            <div>
              <p class="text-sm text-muted-foreground">Starts</p>
              <p class="mt-1 font-medium text-foreground">
                {formatDate(billingState.currentPeriod?.start)}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Ends</p>
              <p class="mt-1 font-medium text-foreground">
                {formatDate(billingState.currentPeriod?.end)}
              </p>
            </div>
          </div>
          <Button variant="outline" href="/settings/billing">
            Manage billing
          </Button>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      {#each usageItems as item (item.signal)}
        <Card class="border-border/80">
          <CardHeader class="gap-2">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                {#if item.signal === "logs"}
                  <IconDatabase class="size-4 text-muted-foreground" />
                {:else}
                  <IconChartPie2 class="size-4 text-muted-foreground" />
                {/if}
                <CardTitle>{formatSignal(item.signal)}</CardTitle>
              </div>
              <Badge variant="outline">{item.retentionDays} days</Badge>
            </div>
            <CardDescription>Retention and ingest for this period.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="grid gap-2">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="font-medium text-foreground">
                    {formatBytes(item.usedBytes)}
                  </p>
                  <p class="text-sm text-muted-foreground">
                    of {formatBytes(item.includedBytes)}
                  </p>
                </div>
                <p class="text-sm font-medium text-muted-foreground">
                  {item.usagePercent}%
                </p>
              </div>
              <Progress value={item.usagePercent} />
            </div>

            <div class="flex items-center justify-between border-t pt-3 text-sm">
              <span class="text-muted-foreground">Overage</span>
              <span class="font-medium text-foreground">
                {formatBytes(item.overageBytes)}
              </span>
            </div>
          </CardContent>
        </Card>
      {/each}
    </div>
  {/if}
</PageContainer>
