<script lang="ts">
  import { page } from "$app/state";
  import {
    createBillingPortalCommand,
    getBillingStateQuery,
    updateOverageSettingsCommand,
  } from "$lib/api/billing.remote";
  import { PLANS } from "$lib/constants";
  import { cn } from "@repo/components";
  import { Badge } from "@repo/components/ui/badge";
  import { Button } from "@repo/components/ui/button";
  import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@repo/components/ui/card";
  import { Progress } from "@repo/components/ui/progress";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import { Separator } from "@repo/components/ui/separator";
  import { Skeleton } from "@repo/components/ui/skeleton";
  import { Switch } from "@repo/components/ui/switch";
  import { formatBytes } from "@repo/utils";
  import {
    IconArrowUpRight,
    IconDeviceFloppy,
    IconExternalLink,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  type BillingStateResult = Awaited<ReturnType<typeof getBillingStateQuery>>;
  type BillingState = Extract<BillingStateResult, { success: true }>["data"];

  let loading = $state(true);
  let portalLoading = $state(false);
  let overageSettingsLoading = $state(false);
  let error = $state("");
  let success = $state("");
  let billingState = $state<BillingState | null>(null);
  let ingestOverageEnabled = $state(false);
  let ingestOverageBudget = $state("");
  let scoutOverageEnabled = $state(false);
  let scoutOverageBudget = $state("");

  const totalIngestedBytes = $derived(
    (billingState?.logsIngestedBytes ?? 0) +
      (billingState?.metricsIngestedBytes ?? 0) +
      (billingState?.tracesIngestedBytes ?? 0),
  );
  const ingestUsagePercent = $derived(
    billingState?.ingestLimitBytes
      ? Math.min(
          100,
          Math.round(
            (totalIngestedBytes / billingState.ingestLimitBytes) * 100,
          ),
        )
      : 0,
  );
  const ingestOverageBytes = $derived(
    Math.max(0, totalIngestedBytes - (billingState?.ingestLimitBytes ?? 0)),
  );
  const currentPlan = $derived(
    billingState?.billingPlan === "pro" ? PLANS.pro : null,
  );
  const ingestOverageCost = $derived(
    (ingestOverageBytes / Math.pow(1024, 3)) *
      (currentPlan?.overagePricePerGb ?? 0),
  );
  const scoutOverageCredits = $derived(
    Math.max(
      0,
      (billingState?.chatUsage?.usedCredits ?? 0) -
        (billingState?.chatUsage?.includedCredits ?? 0),
    ),
  );
  const scoutOverageCost = $derived(
    (scoutOverageCredits / 1_000_000) *
      (currentPlan?.scoutOveragePricePerMillionCredits ?? 0),
  );
  const signalRows = $derived(
    billingState
      ? [
          {
            signal: "Logs",
            usedBytes: billingState.logsIngestedBytes,
            retentionDays: billingState.logsRetentionDays,
          },
          {
            signal: "Metrics",
            usedBytes: billingState.metricsIngestedBytes,
            retentionDays: billingState.metricsRetentionDays,
          },
          {
            signal: "Traces",
            usedBytes: billingState.tracesIngestedBytes,
            retentionDays: billingState.tracesRetentionDays,
          },
        ]
      : [],
  );
  const formatDate = (date: Date | string | number) =>
    new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const loadBillingState = async () => {
    loading = true;
    error = "";

    const result = await getBillingStateQuery({});
    if (result.success === false) {
      error = result.error;
      loading = false;
      return;
    }

    billingState = result.data;
    ingestOverageEnabled = result.data.ingestOverageEnabled;
    ingestOverageBudget = result.data.ingestOverageBudgetCents
      ? String(result.data.ingestOverageBudgetCents / 100)
      : "";
    scoutOverageEnabled = result.data.scoutOverageEnabled;
    scoutOverageBudget = result.data.scoutOverageBudgetCents
      ? String(result.data.scoutOverageBudgetCents / 100)
      : "";
    loading = false;
  };

  const saveOverageSettings = async () => {
    const ingestBudgetCents = ingestOverageBudget.trim()
      ? Math.round(Number(ingestOverageBudget) * 100)
      : null;
    const scoutBudgetCents = scoutOverageBudget.trim()
      ? Math.round(Number(scoutOverageBudget) * 100)
      : null;
    if (
      (ingestBudgetCents !== null &&
        (!Number.isFinite(ingestBudgetCents) || ingestBudgetCents < 100)) ||
      (scoutBudgetCents !== null &&
        (!Number.isFinite(scoutBudgetCents) || scoutBudgetCents < 100))
    ) {
      error = "Monthly overage budgets must be at least $1, or left blank.";
      return;
    }

    overageSettingsLoading = true;
    error = "";
    success = "";
    const result = await updateOverageSettingsCommand({
      ingestOverageEnabled,
      ingestOverageBudgetCents: ingestBudgetCents,
      scoutOverageEnabled,
      scoutOverageBudgetCents: scoutBudgetCents,
    });
    if (!result.success) {
      error = result.error;
      overageSettingsLoading = false;
      return;
    }

    if (billingState) {
      billingState = {
        ...billingState,
        ingestOverageEnabled,
        ingestOverageBudgetCents: ingestBudgetCents,
        scoutOverageEnabled,
        scoutOverageBudgetCents: scoutBudgetCents,
      };
    }
    success = "Usage controls updated.";
    overageSettingsLoading = false;
  };

  const openPortal = async () => {
    portalLoading = true;
    error = "";
    success = "";

    const result = await createBillingPortalCommand({
      appId: page.params.app_id!,
    });
    if (result.success === false) {
      error = result.error;
      portalLoading = false;
      return;
    }

    window.location.href = result.data.url;
  };

  onMount(() => {
    const checkoutState = page.url.searchParams.get("checkout");
    const onboarding = page.url.searchParams.get("onboarding");

    if (checkoutState === "success") {
      success = "Billing checkout completed.";
    } else if (checkoutState === "cancelled") {
      error = "Billing checkout was cancelled.";
    } else if (onboarding === "1") {
      success = "Choose a plan to activate this organization.";
    }

    void loadBillingState();
  });
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-5 py-1">
  {#if error}
    <div
      id="billing-error-banner"
      class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {error}
    </div>
  {/if}

  {#if success}
    <div
      id="billing-success-banner"
      class="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground"
    >
      {success}
    </div>
  {/if}

  <Card class="gap-5 py-5">
    <CardHeader class="px-5">
      {#if loading}
        <Skeleton class="h-6 w-28" />
        <Skeleton class="mt-1 h-4 w-44" />
      {:else}
        <div class="flex items-center gap-2">
          <CardTitle class="text-xl capitalize">
            {billingState?.billingPlan ?? "No active plan"}
          </CardTitle>
          {#if billingState?.billingStatus}
            <Badge
              variant={billingState.billingStatus === "active"
                ? "secondary"
                : billingState.billingStatus === "trialing"
                  ? "outline"
                  : "destructive"}
              class="capitalize"
            >
              {billingState.billingStatus.replace("_", " ")}
            </Badge>
          {/if}
        </div>
        <CardDescription>
          {#if currentPlan}
            ${currentPlan.priceUsd} per month
          {:else}
            Add billing details to activate this organization.
          {/if}
        </CardDescription>
      {/if}

      <CardAction>
        <Button
          disabled={loading || portalLoading}
          loading={portalLoading}
          onclick={openPortal}
        >
          <IconExternalLink data-slot="button-icon" />
          Manage billing
        </Button>
      </CardAction>
    </CardHeader>

    <Separator />

    <CardContent class="grid gap-1 px-5 sm:grid-cols-2 sm:gap-8">
      <div>
        <p class="text-sm text-muted-foreground">Billing period</p>
        {#if loading}
          <Skeleton class="mt-2 h-5 w-48" />
        {:else}
          <p class="mt-1 font-medium tabular-nums">
            {billingState?.currentPeriodStart && billingState.currentPeriodEnd
              ? `${formatDate(billingState.currentPeriodStart)} – ${formatDate(billingState.currentPeriodEnd)}`
              : "Not available"}
          </p>
        {/if}
      </div>

      <div class="max-sm:mt-4">
        <p class="text-sm text-muted-foreground">
          {billingState?.billingStatus === "trialing"
            ? "Trial ends"
            : "Period ends"}
        </p>
        {#if loading}
          <Skeleton class="mt-2 h-5 w-28" />
        {:else}
          <p class="mt-1 font-medium tabular-nums">
            {billingState?.currentPeriodEnd
              ? formatDate(billingState.currentPeriodEnd)
              : "Not available"}
          </p>
        {/if}
      </div>
    </CardContent>
  </Card>

  <Card class="gap-5 py-5">
    <CardHeader class="px-5">
      <CardTitle>Usage this billing cycle</CardTitle>
      <CardDescription>
        Logs, metrics, and traces share your included ingest allowance.
      </CardDescription>
    </CardHeader>

    <CardContent class="grid gap-5 px-5">
      <div class="grid gap-3">
        <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <p class="text-sm font-medium">Ingest</p>
            {#if loading}
              <Skeleton class="mt-2 h-7 w-48" />
            {:else}
              <p
                class="mt-1 text-2xl font-semibold tracking-tight tabular-nums"
              >
                {formatBytes(totalIngestedBytes, "GB")}
                <span class="text-base font-normal text-muted-foreground">
                  of {formatBytes(billingState?.ingestLimitBytes ?? 0, "GB")}
                </span>
              </p>
            {/if}
          </div>

          {#if !loading}
            <p class="text-sm text-muted-foreground tabular-nums">
              {ingestUsagePercent}% used
            </p>
          {/if}
        </div>

        {#if loading}
          <Skeleton class="h-2 w-full rounded-full" />
        {:else}
          <Progress
            value={ingestUsagePercent}
            aria-label={`${ingestUsagePercent}% of included ingest used`}
            class={cn(
              "h-2 bg-muted/80",
              ingestUsagePercent >= 90
                ? "*:bg-destructive"
                : ingestUsagePercent >= 70
                  ? "*:bg-amber-500"
                  : "*:bg-primary",
            )}
          />
          {#if ingestOverageBytes > 0}
            <div
              class="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <Badge variant="destructive">Overage</Badge>
              <p class="text-muted-foreground tabular-nums">
                {formatBytes(ingestOverageBytes, "GB")} additional · approximately
                {formatCurrency(ingestOverageCost)}
              </p>
            </div>
          {/if}
        {/if}
      </div>

      <div class="overflow-hidden rounded-lg border">
        {#if loading}
          {#each [1, 2, 3] as row (row)}
            <div
              class="grid grid-cols-3 items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <Skeleton class="h-4 w-16" />
              <Skeleton class="h-4 w-20 justify-self-end" />
              <Skeleton class="h-4 w-24 justify-self-end" />
            </div>
          {/each}
        {:else}
          {#each signalRows as usage (usage.signal)}
            <div
              class="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto]"
            >
              <p class="font-medium">{usage.signal}</p>
              <p class="text-right tabular-nums">
                {formatBytes(usage.usedBytes, "GB")}
              </p>
              <p
                class="col-span-2 text-muted-foreground sm:col-span-1 sm:min-w-28 sm:text-right"
              >
                {usage.retentionDays}-day retention
              </p>
            </div>
          {/each}
        {/if}
      </div>

      {#if loading || billingState?.chatUsage}
        <Separator />

        <div class="grid gap-3">
          <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <p class="text-sm font-medium">Scout credits</p>
              {#if loading}
                <Skeleton class="mt-2 h-6 w-44" />
              {:else if billingState?.chatUsage}
                <p
                  class="mt-1 text-lg font-semibold tracking-tight tabular-nums"
                >
                  {billingState.chatUsage.usedCredits.toLocaleString()}
                  <span class="text-sm font-normal text-muted-foreground">
                    of {billingState.chatUsage.includedCredits.toLocaleString()} used
                  </span>
                </p>
              {/if}
            </div>

            {#if billingState?.chatUsage}
              <p class="text-sm text-muted-foreground tabular-nums">
                {billingState.chatUsage.remainingCredits.toLocaleString()} remaining
              </p>
            {/if}
          </div>

          {#if loading}
            <Skeleton class="h-2 w-full rounded-full" />
          {:else if billingState?.chatUsage}
            {@const scoutUsagePercent = billingState.chatUsage.includedCredits
              ? Math.min(
                  100,
                  Math.round(
                    (billingState.chatUsage.usedCredits /
                      billingState.chatUsage.includedCredits) *
                      100,
                  ),
                )
              : 0}
            <Progress
              value={scoutUsagePercent}
              aria-label={`${scoutUsagePercent}% of included Scout credits used`}
              class={cn(
                "h-2 bg-muted/80",
                scoutUsagePercent >= 90
                  ? "*:bg-destructive"
                  : scoutUsagePercent >= 70
                    ? "*:bg-amber-500"
                    : "*:bg-primary",
              )}
            />
            {#if scoutOverageCredits > 0}
              <div
                class="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <Badge variant="destructive">Overage</Badge>
                <p class="text-muted-foreground tabular-nums">
                  {scoutOverageCredits.toLocaleString()} additional credits · approximately
                  {formatCurrency(scoutOverageCost)}
                </p>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card class="gap-5 py-5">
    <CardHeader class="px-5">
      <CardTitle>Usage controls</CardTitle>
      <CardDescription>
        Choose whether usage can continue beyond the included monthly
        allowances. Previously incurred usage remains billable when a control is
        disabled.
      </CardDescription>
    </CardHeader>

    <CardContent class="grid gap-4 px-5">
      <div
        class="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_12rem] sm:items-center"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <Label for="ingest-overage-enabled">Automatic ingest overages</Label
            >
            <p class="mt-1 text-sm text-muted-foreground">
              Continue ingesting at $0.32 per additional GB.
            </p>
          </div>
          <Switch
            id="ingest-overage-enabled"
            bind:checked={ingestOverageEnabled}
            disabled={loading ||
              overageSettingsLoading ||
              !billingState?.canManageBilling ||
              billingState?.billingStatus !== "active"}
          />
        </div>

        <div class="grid gap-1.5">
          <Label for="ingest-overage-budget">Monthly budget</Label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
              >$</span
            >
            <Input
              id="ingest-overage-budget"
              type="number"
              min="1"
              max="10000"
              step="1"
              placeholder="No limit"
              class="pl-7"
              bind:value={ingestOverageBudget}
              disabled={loading ||
                overageSettingsLoading ||
                !ingestOverageEnabled ||
                !billingState?.canManageBilling ||
                billingState?.billingStatus !== "active"}
            />
          </div>
        </div>
      </div>

      <div
        class="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_12rem] sm:items-center"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <Label for="scout-overage-enabled">Automatic Scout overages</Label>
            <p class="mt-1 text-sm text-muted-foreground">
              Continue Scout conversations at $1 per 1M additional credits.
            </p>
          </div>
          <Switch
            id="scout-overage-enabled"
            bind:checked={scoutOverageEnabled}
            disabled={loading ||
              overageSettingsLoading ||
              !billingState?.canManageBilling ||
              billingState?.billingStatus !== "active"}
          />
        </div>

        <div class="grid gap-1.5">
          <Label for="scout-overage-budget">Monthly budget</Label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
              >$</span
            >
            <Input
              id="scout-overage-budget"
              type="number"
              min="1"
              max="10000"
              step="1"
              placeholder="No limit"
              class="pl-7"
              bind:value={scoutOverageBudget}
              disabled={loading ||
                overageSettingsLoading ||
                !scoutOverageEnabled ||
                !billingState?.canManageBilling ||
                billingState?.billingStatus !== "active"}
            />
          </div>
        </div>
      </div>

      <div
        class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
      >
        <p class="text-sm text-muted-foreground">
          {#if billingState?.billingStatus !== "active"}
            Usage controls become available when the Pro subscription is active.
          {:else if !billingState?.canManageBilling}
            Only an organization owner can change usage controls.
          {:else}
            Leave a budget blank for no monthly overage limit.
          {/if}
        </p>
        <Button
          loading={overageSettingsLoading}
          disabled={loading ||
            overageSettingsLoading ||
            !billingState?.canManageBilling ||
            billingState?.billingStatus !== "active"}
          onclick={saveOverageSettings}
        >
          <IconDeviceFloppy data-slot="button-icon" />
          Save usage controls
        </Button>
      </div>
    </CardContent>
  </Card>

  <Card class="gap-5 py-5">
    <CardHeader class="px-5">
      <CardTitle>Plan details</CardTitle>
      <CardDescription>Your current monthly allowances.</CardDescription>
    </CardHeader>

    <CardContent class="grid gap-5 px-5 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p class="text-sm text-muted-foreground">Included ingest</p>
        {#if loading}
          <Skeleton class="mt-2 h-5 w-20" />
        {:else}
          <p class="mt-1 font-medium tabular-nums">
            {formatBytes(billingState?.ingestLimitBytes ?? 0, "GB")} / month
          </p>
        {/if}
      </div>

      <div>
        <p class="text-sm text-muted-foreground">Data retention</p>
        {#if loading}
          <Skeleton class="mt-2 h-5 w-20" />
        {:else}
          <p class="mt-1 font-medium">
            {billingState
              ? `${billingState.logsRetentionDays} days`
              : "Not available"}
          </p>
        {/if}
      </div>

      <div>
        <p class="text-sm text-muted-foreground">Additional ingest</p>
        {#if loading}
          <Skeleton class="mt-2 h-5 w-24" />
        {:else}
          <p class="mt-1 font-medium tabular-nums">
            {currentPlan?.overagePricePerGb
              ? `$${currentPlan.overagePricePerGb.toFixed(2)} / GB`
              : "Not available"}
          </p>
        {/if}
      </div>

      <div>
        <p class="text-sm text-muted-foreground">Additional Scout usage</p>
        {#if loading}
          <Skeleton class="mt-2 h-5 w-24" />
        {:else}
          <p class="mt-1 font-medium tabular-nums">
            {currentPlan
              ? `$${currentPlan.scoutOveragePricePerMillionCredits.toFixed(2)} / 1M credits`
              : "Not available"}
          </p>
        {/if}
      </div>
    </CardContent>
  </Card>

  <div
    class="flex flex-col gap-4 rounded-xl border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <p class="font-medium">Need higher limits?</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Talk to us about custom ingest, retention, and support.
      </p>
    </div>
    <Button variant="outline" href="mailto:team@orvo.sh">
      Contact sales
      <IconArrowUpRight data-slot="button-icon" />
    </Button>
  </div>
</div>
