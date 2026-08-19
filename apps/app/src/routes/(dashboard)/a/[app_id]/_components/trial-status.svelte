<script lang="ts">
  import { page } from "$app/state";
  import * as AlertDialog from "@repo/components/ui/alert-dialog";
  import { Button } from "@repo/components/ui/button";
  import {
    IconCreditCard as CreditCardIcon,
    IconInfoCircle as InfoCircleIcon,
  } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  let {
    billingStatus,
    trialEnd,
    billingHref,
    bannerVisible = $bindable(false),
  }: {
    billingStatus: string | null;
    trialEnd: Date | string | null;
    billingHref: string;
    bannerVisible?: boolean;
  } = $props();

  let now = $state(Date.now());

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
      href={billingHref}
      variant="link"
      size="sm"
      class="h-auto px-1 text-amber-950 underline decoration-1 underline-offset-2 dark:text-amber-50"
    >
      Add billing details
    </Button>
  </div>
{/if}

{#if trialExpired && !isBillingPage}
  <AlertDialog.Root open={true} onOpenChange={() => {}}>
    <AlertDialog.Content data-testid="trial-expired-dialog">
      <AlertDialog.Header>
        <AlertDialog.Title>Your trial has expired</AlertDialog.Title>
        <AlertDialog.Description>
          Your trial has ended. Choose a plan to restore access and resume
          telemetry ingestion.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <Button href={billingHref} class="w-full sm:w-auto">
          <CreditCardIcon data-slot="button-icon" />
          Add billing details
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
