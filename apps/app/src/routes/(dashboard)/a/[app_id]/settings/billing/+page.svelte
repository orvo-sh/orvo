<script lang="ts">
  import { page } from "$app/state";
  import { PLANS } from "$lib/constants";
  import { createBillingPortalCommand, getBillingStateQuery } from "$lib/api/billing.remote";
  import { Button } from "@repo/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@repo/components/ui/card";
  import { onMount } from "svelte";

  type BillingStateResult = Awaited<ReturnType<typeof getBillingStateQuery>>;
  type BillingState = Extract<BillingStateResult, { success: true }>["data"];
  type BillingSignal = "logs" | "metrics" | "traces";

  const bytesPerGb = 1_000_000_000;
  const planCards = [
    {
      key: "starter",
      name: "Starter",
      priceLabel: `$${PLANS.starter.priceUsd}/month`,
      includedGb: Math.round(PLANS.starter.ingestLimitBytes / bytesPerGb),
      retentionDays: PLANS.starter.retentionDays,
      overagePricePerGb: PLANS.starter.overagePricePerGb,
    },
    {
      key: "pro",
      name: "Pro",
      priceLabel: `$${PLANS.pro.priceUsd}/month`,
      includedGb: Math.round(PLANS.pro.ingestLimitBytes / bytesPerGb),
      retentionDays: PLANS.pro.retentionDays,
      overagePricePerGb: PLANS.pro.overagePricePerGb,
    },
    {
      key: "enterprise",
      name: "Enterprise",
      priceLabel: "Custom",
      includedGb: null,
      retentionDays: null,
      overagePricePerGb: null,
    },
  ] as const;

  let loading = $state(true);
  let portalLoading = $state(false);
  let error = $state("");
  let success = $state("");
  let billingState = $state<BillingState | null>(null);

  const signalCards = $derived.by(() => {
    if (!billingState) {
      return [];
    }
    const currentBillingState = billingState;

    return ([
      {
        signal: "logs",
        usedBytes: currentBillingState.logsIngestedBytes,
        retentionDays: currentBillingState.logsRetentionDays,
      },
      {
        signal: "metrics",
        usedBytes: currentBillingState.metricsIngestedBytes,
        retentionDays: currentBillingState.metricsRetentionDays,
      },
      {
        signal: "traces",
        usedBytes: currentBillingState.tracesIngestedBytes,
        retentionDays: currentBillingState.tracesRetentionDays,
      },
    ] as const satisfies Array<{
      signal: BillingSignal;
      usedBytes: number;
      retentionDays: number;
    }>).map((signalCard) => ({
      ...signalCard,
      usagePercent:
        currentBillingState.ingestLimitBytes > 0
          ? Math.min(
              100,
              Math.round(
                (signalCard.usedBytes / currentBillingState.ingestLimitBytes) * 100,
              ),
            )
          : 0,
    }));
  });

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
    loading = false;
  };

  const openPortal = async () => {
    portalLoading = true;
    error = "";
    success = "";

    const result = await createBillingPortalCommand({});
    if (result.success === false) {
      error = result.error;
      portalLoading = false;
      return;
    }

    window.location.href = result.data.url;
  };

  const getStatusLabel = () => {
    if (!billingState?.billingPlan || !billingState.billingStatus) {
      return "No active plan";
    }

    return `${billingState.billingPlan} ${billingState.billingStatus}`;
  };

  const getTrialCopy = () => {
    if (!billingState?.currentPeriodEnd) {
      return "Choose a plan to activate your organization.";
    }

    if (billingState.billingStatus === "trialing") {
      return `Trial ends on ${new Date(billingState.currentPeriodEnd).toLocaleDateString()}.`;
    }

    return `Current period ends on ${new Date(billingState.currentPeriodEnd).toLocaleDateString()}.`;
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

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 py-1">
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

  <div class="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
    <Card>
      <CardHeader class="gap-1">
        <CardTitle>Billing overview</CardTitle>
        <CardDescription>
          {loading ? "Loading billing state..." : getTrialCopy()}
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border p-4">
            <p class="text-sm text-muted-foreground">Current status</p>
            <p class="mt-2 text-lg font-semibold text-foreground">
              {loading ? "Loading..." : getStatusLabel()}
            </p>
          </div>

          <div class="rounded-xl border p-4">
            <p class="text-sm text-muted-foreground">Current period</p>
            <p class="mt-2 text-lg font-semibold text-foreground">
              {loading
                ? "Loading..."
                : billingState?.currentPeriodEnd
                  ? `${new Date(billingState.currentPeriodStart).toLocaleDateString()} to ${new Date(billingState.currentPeriodEnd).toLocaleDateString()}`
                  : "Not available"}
            </p>
          </div>
        </div>

        <div class="grid gap-3">
          <p class="text-sm font-medium text-foreground">Billing actions</p>
          <p class="text-sm text-muted-foreground">
            Open the billing portal to manage the organization subscription.
          </p>
          <div class="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={loading || portalLoading}
              loading={portalLoading}
              onclick={openPortal}
            >
              Manage billing
            </Button>

            <Button variant="outline" href="mailto:team@orvo.sh">
              Contact sales
            </Button>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          {#each signalCards as usage (usage.signal)}
            <div class="rounded-xl border p-4">
              <p class="text-sm text-muted-foreground capitalize">
                {usage.signal}
              </p>
              <p class="mt-2 text-lg font-semibold text-foreground">
                {loading
                  ? "Loading..."
                  : `${(usage.usedBytes / bytesPerGb).toFixed(1)} GB used`}
              </p>
              <p class="mt-1 text-sm text-muted-foreground">
                {loading
                  ? ""
                  : `${usage.retentionDays} day retention, ${usage.usagePercent}% of plan limit`}
              </p>
            </div>
          {/each}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="gap-1">
        <CardTitle>Enterprise</CardTitle>
        <CardDescription>
          Custom retention, custom limits, and tailored commercial terms.
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <p class="text-sm text-muted-foreground">
          If you need custom data retention, volume, or support requirements,
          talk to the team.
        </p>
        <Button variant="outline" href="mailto:team@orvo.sh">
          Contact sales
        </Button>
      </CardContent>
    </Card>
  </div>

  <div class="grid gap-6 xl:grid-cols-3">
    {#each planCards as plan (plan.key)}
      <Card class="border-border/80">
        <CardHeader class="gap-1">
          <CardTitle>{plan.name}</CardTitle>
          <CardDescription>{plan.priceLabel}</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div class="space-y-1 text-sm text-muted-foreground">
            {#if plan.includedGb !== null}
              <p>Ingest: {plan.includedGb} GB / month</p>
            {/if}
            {#if plan.retentionDays}
              <p>Logs retention: {plan.retentionDays.logs} days</p>
              <p>Metrics retention: {plan.retentionDays.metrics} days</p>
              <p>Traces retention: {plan.retentionDays.traces} days</p>
            {/if}
            {#if plan.overagePricePerGb}
              <p>${plan.overagePricePerGb.toFixed(2)} / GB overage</p>
            {/if}
          </div>

          {#if plan.key === "enterprise"}
            <Button variant="outline" href="mailto:team@orvo.sh">
              Contact sales
            </Button>
          {:else}
            <Button
              disabled={loading || portalLoading}
              loading={portalLoading}
              variant="outline"
              onclick={openPortal}
            >
              Manage plan
            </Button>
          {/if}
        </CardContent>
      </Card>
    {/each}
  </div>
</div>
