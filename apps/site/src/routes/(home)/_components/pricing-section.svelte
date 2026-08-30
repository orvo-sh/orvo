<script lang="ts">
  import { PRO_PLAN } from '$lib/pricing';
  import { Badge } from '@repo/components/ui/badge';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowRight, IconCalendar, IconDatabase, IconSparkles } from '@tabler/icons-svelte';

  const includedUsage = [
    {
      icon: IconDatabase,
      label: 'Telemetry ingest',
      value: `${PRO_PLAN.includedIngestGb} GB`,
      overage: `then $${PRO_PLAN.ingestOveragePerGb.toFixed(2)} / GB`
    },
    {
      icon: IconSparkles,
      label: 'Scout credits',
      value: PRO_PLAN.includedScoutCredits.toLocaleString(),
      overage: `then $${PRO_PLAN.scoutOveragePerThousandCredits} / 1,000`
    },
    {
      icon: IconCalendar,
      label: 'Data retention',
      value: `${PRO_PLAN.retentionDays} days`,
      overage: 'logs, traces, and metrics'
    }
  ];
</script>

<section id="pricing" class="border-foreground/10 bg-background border-b py-16 md:py-24">
  <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
    <div class="max-w-2xl">
      <p class="text-primary text-xs font-medium tracking-[0.16em] uppercase">Pricing</p>
      <h2 class="mt-3 text-3xl font-medium tracking-tight text-balance lg:text-5xl">
        One plan. A bill you can explain.
      </h2>
      <p class="text-secondary-foreground mt-4 text-base leading-relaxed text-balance">
        Start with a fixed monthly price, then pay only when your telemetry or Scout usage grows
        beyond what is included.
      </p>
    </div>

    <Card.Root
      class="mt-10 gap-0 overflow-hidden p-0 shadow-none lg:grid lg:grid-cols-[0.82fr_1.18fr]"
    >
      <div
        class="bg-muted/35 border-border/70 flex flex-col border-b p-6 lg:border-r lg:border-b-0"
      >
        <div class="flex items-center gap-2">
          <p class="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">Pro</p>
          <Badge variant="secondary" class="rounded-full">{PRO_PLAN.trialDays}-day trial</Badge>
        </div>

        <div class="mt-8 flex items-end gap-2">
          <span class="text-5xl font-semibold tracking-tight tabular-nums">
            ${PRO_PLAN.priceUsd}
          </span>
          <span class="text-muted-foreground mb-1 text-base">/ month</span>
        </div>
        <p class="text-muted-foreground mt-3">Everything in the product is included.</p>

        <div class="mt-8 grid grid-cols-3 gap-3">
          {#each ['host', 'seat', 'query'] as unit (unit)}
            <div>
              <p class="text-2xl font-medium tabular-nums">$0</p>
              <p class="text-muted-foreground mt-1 text-[11px] tracking-wide uppercase">
                per {unit}
              </p>
            </div>
          {/each}
        </div>

        <Button href="https://app.orvo.sh/sign-up" size="lg" class="mt-10 w-full">
          Start {PRO_PLAN.trialDays}-day free trial
          <IconArrowRight data-slot="button-icon" />
        </Button>
        <p class="text-muted-foreground mt-3 text-xs leading-relaxed">
          Cancel anytime. A card is required to start the trial.
        </p>
      </div>

      <div class="flex min-w-0 flex-col p-6">
        <p class="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          Included every month
        </p>

        <div class="mt-5 divide-y">
          {#each includedUsage as item (item.label)}
            {@const Icon = item.icon}
            <div
              class="grid gap-2 py-4 first:pt-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-8"
            >
              <div class="flex items-center gap-3">
                <Icon class="text-muted-foreground size-4" />
                <span class="font-medium">{item.label}</span>
              </div>
              <span class="font-mono text-sm tabular-nums">{item.value}</span>
              <span class="text-muted-foreground text-sm">{item.overage}</span>
            </div>
          {/each}
        </div>

        <div class="border-border/70 mt-auto border-t pt-5">
          <p class="text-muted-foreground text-sm leading-relaxed">
            Unlimited dashboards · Advanced alerting · MCP server · Scout investigations · Full API
            access
          </p>
          <Button href="/pricing#estimate" variant="link" class="mt-3 h-auto px-0">
            Estimate your bill
            <IconArrowRight data-slot="button-icon" />
          </Button>
        </div>
      </div>
    </Card.Root>

    <div class="mt-5 grid gap-5 md:grid-cols-2">
      <div class="flex items-center justify-between gap-4 rounded-xl border p-5">
        <div>
          <p class="font-medium">Orvo Local</p>
          <p class="text-muted-foreground mt-1 text-sm">Self-host the open-source stack for $0.</p>
        </div>
        <Button
          href="https://github.com/orvo-sh/orvo"
          target="_blank"
          rel="noreferrer"
          variant="outline"
        >
          View source
        </Button>
      </div>
      <div class="flex items-center justify-between gap-4 rounded-xl border p-5">
        <div>
          <p class="font-medium">Enterprise</p>
          <p class="text-muted-foreground mt-1 text-sm">Custom scale, controls, and support.</p>
        </div>
        <Button href="mailto:team@orvo.sh" variant="outline">Contact us</Button>
      </div>
    </div>
  </div>
</section>
