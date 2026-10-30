<script lang="ts">
  import { page } from "$app/state";
  import { createBillingPortalCommand } from "$lib/api/billing.remote";
  import { PLANS } from "$lib/constants";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { Button } from "@repo/components/ui/button";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconCreditCard as CreditCardIcon,
    IconInfoCircle as InfoCircleIcon,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  let {
    billingStatus,
    billingActionLabel,
    canManageBilling,
    trialEnded,
    hasPaymentMethod,
    trialEnd,
    billingHref,
    bannerVisible = $bindable(false),
  }: {
    billingStatus: string | null;
    billingActionLabel: string;
    canManageBilling: boolean;
    trialEnded: boolean;
    hasPaymentMethod: boolean | null;
    trialEnd: Date | string | null;
    billingHref: string;
    bannerVisible?: boolean;
  } = $props();

  let now = $state(Date.now());
  let billingLoading = $state(false);

  const openBilling = async () => {
    if (billingLoading) return;
    billingLoading = true;

    try {
      const result = await createBillingPortalCommand({
        appId: page.params.app_id!,
        flow: "payment_method_update",
        returnPath: page.url.pathname + page.url.search + page.url.hash,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      window.location.href = result.data.url;
    } catch {
      toast.error("Failed to open billing details. Please try again.");
    } finally {
      billingLoading = false;
    }
  };

  const trialEndTime = $derived(trialEnd ? new Date(trialEnd).getTime() : null);
  const daysRemaining = $derived(
    trialEndTime === null
      ? null
      : Math.max(0, Math.ceil((trialEndTime - now) / 86_400_000)),
  );
  const trialExpired = $derived(
    trialEndTime !== null && trialEndTime <= now && billingStatus !== "active",
  );
  const trialEnding = $derived(
    billingStatus === "trialing" &&
      hasPaymentMethod === false &&
      daysRemaining !== null &&
      daysRemaining > 0 &&
      daysRemaining <= 5,
  );
  const isBillingPage = $derived(page.url.pathname === billingHref);

  $effect(() => {
    bannerVisible = trialEnding;
  });

  onMount(() => {
    now = Date.now();
    const timer = window.setInterval(() => {
      now = Date.now();
    }, 30_000);

    return () => window.clearInterval(timer);
  });
</script>

{#if trialEnding}
  <div
    data-testid="trial-ending-banner"
    class="relative z-20 flex min-h-10 w-full shrink-0 flex-wrap items-center justify-center gap-1 border-b bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:bg-amber-900 dark:text-amber-50"
  >
    <InfoCircleIcon class="size-4 shrink-0" aria-hidden="true" />
    <p>
      Your trial {daysRemaining === 1
        ? "ends in less than a day"
        : `ends in ${daysRemaining} days`}. Add billing details to continue
      without interruption.
    </p>
    <Button
      onclick={openBilling}
      loading={billingLoading}
      disabled={billingLoading || !canManageBilling}
      variant="link"
      size="sm"
      class="h-auto px-1 text-amber-950 underline decoration-1 underline-offset-2 dark:text-amber-50"
    >
      Add billing details
    </Button>
  </div>
{/if}

{#if ["past_due", "unpaid", "incomplete", "paused"].includes(billingStatus ?? "") && !isBillingPage}
  <AlertDialog.Root open={true} onOpenChange={() => {}}>
    <AlertDialog.Content data-testid="past-due-billing-dialog">
      <AlertDialog.Header>
        <AlertDialog.Title>Payment needs attention</AlertDialog.Title>
        <AlertDialog.Description>
          Update your billing details and complete any outstanding payment to
          restore service for this organization.
          {#if !canManageBilling}Ask an organization owner to update billing.{/if}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <Button
          onclick={openBilling}
          loading={billingLoading}
          disabled={billingLoading || !canManageBilling}
          class="w-full sm:w-auto"
        >
          <CreditCardIcon data-slot="button-icon" />
          {billingActionLabel}
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}

{#if (billingStatus === "canceled" || billingStatus === "incomplete_expired" || (trialExpired && billingStatus === "trialing")) && !isBillingPage}
  <AlertDialog.Root open={true} onOpenChange={() => {}}>
    <AlertDialog.Content data-testid="trial-expired-dialog">
      <AlertDialog.Header>
        <AlertDialog.Title
          >{trialEnded || billingStatus === "trialing"
            ? "Your trial has ended"
            : "Subscription required"}</AlertDialog.Title
        >
        <AlertDialog.Description>
          Subscribe to Pro for ${PLANS.pro.priceUsd} per month, plus usage overages,
          to restore access and resume telemetry ingestion. Billing starts when you
          subscribe, with no additional trial.
          {#if !canManageBilling}Ask an organization owner to subscribe.{/if}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <Button
          onclick={openBilling}
          loading={billingLoading}
          disabled={billingLoading || !canManageBilling}
          class="w-full sm:w-auto"
        >
          <CreditCardIcon data-slot="button-icon" />
          {trialExpired && billingStatus === "trialing"
            ? "Subscribe to Pro"
            : billingActionLabel}
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
