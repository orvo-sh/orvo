<script lang="ts">
  import { page } from "$app/state";
  import {
    createBillingPortalCommand,
    getBillingStateQuery,
    updateBillingEmailCommand,
  } from "$lib/api/billing.remote";
  import { Button } from "@repo/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@repo/components/ui/card";
  import { Input } from "@repo/components/ui/input";
  import { onMount } from "svelte";

  type BillingStateResult = Awaited<ReturnType<typeof getBillingStateQuery>>;
  type BillingState = Extract<BillingStateResult, { success: true }>["data"];

  let loading = $state(true);
  let portalLoading = $state(false);
  let savingEmail = $state(false);
  let error = $state("");
  let success = $state("");
  let billingState = $state<BillingState | null>(null);
  let billingEmail = $state("");

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
    billingEmail = result.data.billingEmail ?? "";
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

  const saveBillingEmail = async () => {
    savingEmail = true;
    error = "";
    success = "";

    const result = await updateBillingEmailCommand({
      billingEmail: billingEmail.trim(),
    });
    if (result.success === false) {
      error = result.error;
      savingEmail = false;
      return;
    }

    success = "Billing email updated.";
    savingEmail = false;
    await loadBillingState();
  };

  const getStatusLabel = () => {
    if (!billingState?.subscription) {
      return "No active plan";
    }

    return `${billingState.subscription.plan} ${billingState.subscription.status}`;
  };

  const getTrialCopy = () => {
    const subscription = billingState?.subscription;
    if (!subscription?.trialEnd) {
      return "Choose a plan to activate your organization.";
    }

    return `Trial ends on ${new Date(subscription.trialEnd).toLocaleDateString()}.`;
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
            <p class="text-sm text-muted-foreground">Billing email</p>
            <p class="mt-2 text-lg font-semibold text-foreground">
              {loading
                ? "Loading..."
                : (billingState?.billingEmail ?? "Not set")}
            </p>
          </div>
        </div>

        <div class="grid gap-3">
          <label class="text-sm font-medium text-foreground" for="billing-email"
            >Billing email</label
          >
          <Input
            id="billing-email"
            bind:value={billingEmail}
            type="email"
            placeholder="billing@company.com"
            disabled={loading || billingState?.isOwner === false}
          />
          <div class="flex flex-wrap gap-3">
            <Button
              disabled={loading ||
                savingEmail ||
                billingState?.isOwner === false ||
                billingEmail.trim().length === 0}
              loading={savingEmail}
              onclick={saveBillingEmail}
            >
              Save billing email
            </Button>

            <Button
              variant="outline"
              disabled={loading ||
                portalLoading ||
                billingState?.isOwner === false}
              loading={portalLoading}
              onclick={openPortal}
            >
              Manage billing
            </Button>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          {#each billingState?.usage ?? [] as usage (usage.signal)}
            <div class="rounded-xl border p-4">
              <p class="text-sm text-muted-foreground capitalize">
                {usage.signal}
              </p>
              <p class="mt-2 text-lg font-semibold text-foreground">
                {loading
                  ? "Loading..."
                  : `${((usage.usedBytes ?? 0) / 1_000_000_000 || 0).toFixed(1)} GB / ${((usage.includedBytes ?? 0) / 1_000_000_000 || 0).toFixed(1)} GB`}
              </p>
              <p class="mt-1 text-sm text-muted-foreground">
                {loading ? "" : `${usage.usagePercent ?? 0}% used`}
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
        <Button
          variant="outline"
          href={`mailto:${billingState?.salesEmail ?? "team@orvo.sh"}`}
        >
          Contact sales
        </Button>
      </CardContent>
    </Card>
  </div>

  <div class="grid gap-6 xl:grid-cols-3">
    {#each billingState?.plans ?? [] as plan (plan.key)}
      <Card class="border-border/80">
        <CardHeader class="gap-1">
          <CardTitle>{plan.name}</CardTitle>
          <CardDescription>{plan.priceLabel ?? "Custom"}</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div class="space-y-1 text-sm text-muted-foreground">
            <p>Logs: {plan.includedGbPerSignal.logs} GB / month</p>
            <p>Metrics: {plan.includedGbPerSignal.metrics} GB / month</p>
            <p>Traces: {plan.includedGbPerSignal.traces} GB / month</p>
            <p>Retention: {plan.retentionDays.logs} days</p>
            {#if plan.overagePricePerGb}
              <p>${plan.overagePricePerGb.toFixed(2)} / GB overage</p>
            {/if}
          </div>

          {#if plan.key === "enterprise"}
            <Button
              variant="outline"
              href={`mailto:${billingState?.salesEmail ?? "team@orvo.sh"}`}
            >
              Contact sales
            </Button>
          {:else}
            <Button
              disabled={loading ||
                portalLoading ||
                billingState?.isOwner === false}
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
