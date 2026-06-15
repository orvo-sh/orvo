<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { cn } from "@repo/components";
  import { OrvoLogo } from "@repo/components/icons/orvo-logo";
  import { Button } from "@repo/components/ui/button";
  import * as Card from "@repo/components/ui/card";
  import { toast } from "@repo/components/ui/sonner";
  import { IconArrowRight, IconCheck } from "@tabler/icons-svelte";

  import { PLANS } from "$lib/constants";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let loadingPlan = $state<string | null>(null);

  const startTrial = async (plan: string) => {
    loadingPlan = plan;

    await authClient.subscription
      .upgrade({
        plan,
        customerType: "organization",
        referenceId: data.organizationId,
        successUrl: `${window.location.origin}/`,
        cancelUrl: `${window.location.origin}/organizations/plan`,
        returnUrl: `${window.location.origin}/organizations/plan`,
        disableRedirect: true,
      })
      .then((result) => {
        if (result.error) {
          toast.error(
            result.error.message || "Failed to start the free trial.",
          );
          loadingPlan = null;
          return;
        }

        if (!result.data?.url) {
          toast.error("Failed to start the free trial.");
          loadingPlan = null;
          return;
        }

        window.location.href = result.data.url;
      })
      .catch(() => {
        toast.error("Failed to start the free trial.");
        loadingPlan = null;
      });
  };
</script>

<div class="flex min-h-svh flex-col items-center px-6 py-10 md:px-10">
  <div class="flex w-full max-w-5xl flex-col gap-12">
    <div class="flex flex-col items-center gap-2 text-center">
      <OrvoLogo class="size-14" />
      <div class="space-y-1">
        <h1 class="text-xl font-semibold tracking-tight">Choose a plan</h1>
        <p class="mx-auto max-w-xl text-sm text-muted-foreground">
          Pick a plan to activate this organization and create your first app.
          You can always change or cancel your plan later.
        </p>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      {@render planCard({
        action: {
          kind: "trial",
          planKey: "starter",
          buttonId: "start-starter-trial-button",
          variant: "outline",
        },
        description: "For small teams getting started.",
        features: [
          `${PLANS.starter.ingestLimitBytes / Math.pow(1024, 3)} GB included ingest`,
          `${PLANS.starter.retentionDays.logs} day data retention`,
          "No fee for extra seats",
        ],
        includedLabel: "Included:",
        plan: {
          name: "Starter",
          description: "For small teams getting started.",
          price: `$${PLANS.starter.priceUsd}/month`,
        },
      })}

      {@render planCard({
        action: {
          kind: "trial",
          planKey: "pro",
          buttonId: "start-pro-trial-button",
          showArrow: true,
        },
        description: "For teams shipping production apps.",
        features: [
          `${PLANS.pro.ingestLimitBytes / Math.pow(1024, 3)} GB included ingest`,
          `${PLANS.pro.retentionDays.logs} day data retention`,
          `$${PLANS.pro.overagePricePerGb?.toFixed(2)} / GB overage`,
        ],
        includedLabel: "Everything in Starter plus:",
        plan: {
          name: "Pro",
          description: "For teams shipping production apps.",
          price: `$${PLANS.pro.priceUsd}/month`,
        },
        recommended: true,
      })}

      {@render planCard({
        action: {
          kind: "link",
          href: "mailto:team@orvo.sh",
          buttonId: "contact-enterprise-sales-button",
          variant: "outline",
        },
        description: "For custom scale and support.",
        features: [
          "Custom ingest limits",
          "Custom data retention",
          "Security and procurement support",
          "Priority support",
        ],
        includedLabel: "Everything in Professional plus:",
        plan: {
          name: "Enterprise",
          description: "For custom scale and support.",
          price: "Custom",
        },
      })}
    </div>
  </div>
</div>

{#snippet planCard({
  action,
  description,
  features,
  includedLabel,
  plan,
  recommended = false,
}: {
  action:
    | {
        kind: "trial";
        planKey: string;
        buttonId: string;
        variant?: "outline";
        showArrow?: boolean;
      }
    | {
        kind: "link";
        href: string;
        buttonId: string;
        variant?: "outline";
      };
  description: string;
  features: string[];
  includedLabel: string;
  plan: {
    name: string;
    description: string;
    price: string;
  };
  recommended?: boolean;
})}
  <Card.Root
    class={cn(
      "flex flex-col",
      recommended ? "ring-2 ring-primary/60" : "border-border/80",
    )}
  >
    <Card.Header>
      <Card.Title>{plan?.name}</Card.Title>
      <Card.Description>{description}</Card.Description>
      <div class="pt-3">
        <span class={"text-2xl font-semibold tracking-tight"}>
          {plan?.price}
        </span>
      </div>
    </Card.Header>
    <Card.Content class="flex-1 pb-6">
      <p class="text-sm font-medium">{includedLabel}</p>
      <div class="mt-4 grid gap-3 text-sm">
        {#each features as feature}
          <p class="flex gap-3">
            <IconCheck class="mt-0.5 size-4 shrink-0 text-primary" />
            {feature}
          </p>
        {/each}
      </div>
    </Card.Content>
    <Card.Footer>
      {#if action.kind === "trial"}
        <Button
          id={action.buttonId}
          type="button"
          variant={action.variant}
          class="w-full"
          loading={loadingPlan === action.planKey}
          disabled={loadingPlan !== null}
          onclick={() => startTrial(action.planKey)}
        >
          Start 14 day trial
          <IconArrowRight data-slot="button-icon" />
        </Button>
      {:else}
        <Button
          id={action.buttonId}
          href={action.href}
          variant={action.variant}
          class="w-full"
        >
          Contact sales
        </Button>
      {/if}
    </Card.Footer>
  </Card.Root>
{/snippet}
