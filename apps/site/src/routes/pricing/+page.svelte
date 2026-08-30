<script lang="ts">
  import { PRO_PLAN } from '$lib/pricing';
  import * as Accordion from '@repo/components/ui/accordion';
  import { Badge } from '@repo/components/ui/badge';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import { Slider } from '@repo/components/ui/slider';
  import {
    IconArrowRight,
    IconCheck,
    IconCoin,
    IconDatabase,
    IconServer,
    IconSparkles
  } from '@tabler/icons-svelte';

  const ingestSteps = [0, 25, 50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
  const scoutSteps = [0, 250, 500, 750, 1200, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000];

  let ingestValue = $state(4);
  let scoutValue = $state(4);

  let ingestGb = $derived(ingestSteps[ingestValue]);
  let scoutCredits = $derived(scoutSteps[scoutValue]);
  let ingestOverage = $derived(
    Math.max(0, ingestGb - PRO_PLAN.includedIngestGb) * PRO_PLAN.ingestOveragePerGb
  );
  let scoutOverage = $derived(
    (Math.max(0, scoutCredits - PRO_PLAN.includedScoutCredits) / 1_000) *
      PRO_PLAN.scoutOveragePerThousandCredits
  );
  let estimatedTotal = $derived(PRO_PLAN.priceUsd + ingestOverage + scoutOverage);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(value);

  const formatIngest = (value: number) =>
    value >= 1000
      ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value / 1000)} TB`
      : `${value} GB`;

  const formatScout = (value: number) => value.toLocaleString('en-US');

  const proFeatures = [
    'Logs, traces, metrics, alerts, and heartbeats',
    'Unlimited dashboards, hosts, seats, and queries',
    'Scout investigations and MCP server',
    '30-day retention and full API access'
  ];
</script>

<svelte:head>
  <title>Pricing — Orvo</title>
  <meta
    name="description"
    content="Simple Orvo pricing with 150 GB of telemetry ingest, 1,200 Scout credits, and a transparent monthly cost estimator."
  />
</svelte:head>

<main>
  <section
    class="border-foreground/10 from-muted/70 to-background border-b bg-linear-to-b pt-28 pb-16 md:pt-36 md:pb-24"
  >
    <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
      <Badge variant="outline" class="rounded-full">Predictable by design</Badge>
      <h1
        class="mt-5 max-w-3xl text-4xl font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl"
      >
        Observability pricing without the spreadsheet.
      </h1>
      <p class="text-secondary-foreground mt-5 max-w-2xl text-lg leading-relaxed text-balance">
        One product, one base plan, and two usage meters. No per-host, per-seat, or per-query fees
        hiding in the total.
      </p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href="https://app.orvo.sh/sign-up" size="lg">
          Start {PRO_PLAN.trialDays}-day free trial
          <IconArrowRight data-slot="button-icon" />
        </Button>
        <Button href="#estimate" size="lg" variant="outline">Estimate your bill</Button>
      </div>

      <div class="mt-12 grid max-w-3xl grid-cols-3 gap-4 border-t pt-6">
        {#each ['host', 'seat', 'query'] as unit (unit)}
          <div>
            <p class="text-2xl font-medium tabular-nums">$0</p>
            <p class="text-muted-foreground mt-1 text-xs tracking-wide uppercase">per {unit}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section
    id="estimate"
    class="border-foreground/10 bg-muted/20 scroll-mt-20 border-b py-16 md:py-24"
  >
    <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
      <div class="max-w-2xl">
        <p class="text-primary text-xs font-medium tracking-[0.16em] uppercase">Cost estimator</p>
        <h2 class="mt-3 text-3xl font-medium tracking-tight text-balance lg:text-5xl">
          Model a normal month.
        </h2>
        <p class="text-muted-foreground mt-4 leading-relaxed">
          Move the two inputs Orvo bills on. The estimate updates immediately and shows exactly
          where every dollar comes from.
        </p>
      </div>

      <div class="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <Card.Root class="gap-0 p-0 shadow-none">
          <div class="border-b p-6">
            <div class="flex items-start justify-between gap-5">
              <div class="flex items-center gap-3">
                <span
                  class="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg"
                >
                  <IconDatabase class="size-4" />
                </span>
                <div>
                  <p class="font-medium">Monthly telemetry ingest</p>
                  <p class="text-muted-foreground mt-1 text-sm">
                    Logs, traces, and metrics combined
                  </p>
                </div>
              </div>
              <p class="font-mono text-xl font-medium tabular-nums">{formatIngest(ingestGb)}</p>
            </div>

            <Slider
              bind:value={ingestValue}
              type="single"
              min={0}
              max={ingestSteps.length - 1}
              step={1}
              aria-label="Monthly telemetry ingest"
              class="mt-10 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-track]]:h-2"
            />
            <div class="text-muted-foreground mt-3 flex justify-between text-xs tabular-nums">
              <span>0 GB</span>
              <span class="text-primary">{PRO_PLAN.includedIngestGb} GB included</span>
              <span>5 TB</span>
            </div>
          </div>

          <div class="p-6">
            <div class="flex items-start justify-between gap-5">
              <div class="flex items-center gap-3">
                <span
                  class="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg"
                >
                  <IconSparkles class="size-4" />
                </span>
                <div>
                  <p class="font-medium">Monthly Scout credits</p>
                  <p class="text-muted-foreground mt-1 text-sm">
                    AI investigations across your telemetry
                  </p>
                </div>
              </div>
              <p class="font-mono text-xl font-medium tabular-nums">{formatScout(scoutCredits)}</p>
            </div>

            <Slider
              bind:value={scoutValue}
              type="single"
              min={0}
              max={scoutSteps.length - 1}
              step={1}
              aria-label="Monthly Scout credits"
              class="mt-10 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-track]]:h-2"
            />
            <div class="text-muted-foreground mt-3 flex justify-between text-xs tabular-nums">
              <span>0</span>
              <span class="text-primary">1,200 included</span>
              <span>20,000</span>
            </div>
          </div>
        </Card.Root>

        <Card.Root class="gap-0 p-0 shadow-none lg:sticky lg:top-24">
          <div class="border-b p-5">
            <div class="flex items-center gap-2">
              <IconCoin class="text-primary size-4" />
              <p class="font-medium">Estimated monthly bill</p>
            </div>
            <p class="mt-5 text-4xl font-semibold tracking-tight tabular-nums">
              {formatMoney(estimatedTotal)}
            </p>
            <p class="text-muted-foreground mt-2 text-sm">before applicable taxes</p>
          </div>

          <div class="space-y-3 p-5 text-sm">
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Pro plan</span>
              <span class="font-mono tabular-nums">{formatMoney(PRO_PLAN.priceUsd)}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Ingest overage</span>
              <span class="font-mono tabular-nums">{formatMoney(ingestOverage)}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Scout overage</span>
              <span class="font-mono tabular-nums">{formatMoney(scoutOverage)}</span>
            </div>
          </div>

          <div class="bg-muted/35 border-t p-5">
            <p class="text-muted-foreground text-xs leading-relaxed">
              This estimate uses ${PRO_PLAN.ingestOveragePerGb.toFixed(2)} per GB above
              {PRO_PLAN.includedIngestGb} GB and ${PRO_PLAN.scoutOveragePerThousandCredits} per 1,000
              Scout credits above 1,200.
            </p>
            <Button href="https://app.orvo.sh/sign-up" class="mt-4 w-full">
              Start free trial
              <IconArrowRight data-slot="button-icon" />
            </Button>
          </div>
        </Card.Root>
      </div>
    </div>
  </section>

  <section class="border-foreground/10 border-b py-16 md:py-24">
    <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
      <div class="max-w-2xl">
        <p class="text-primary text-xs font-medium tracking-[0.16em] uppercase">Choose your path</p>
        <h2 class="mt-3 text-3xl font-medium tracking-tight text-balance lg:text-4xl">
          Local, managed, or custom.
        </h2>
      </div>

      <div class="mt-10 grid gap-5 lg:grid-cols-3">
        <Card.Root class="shadow-none">
          <Card.Header>
            <span
              class="bg-muted text-muted-foreground mb-4 flex size-9 items-center justify-center rounded-lg"
            >
              <IconServer class="size-4" />
            </span>
            <Card.Title class="text-lg">Local</Card.Title>
            <Card.Description
              >Run the open-source stack on infrastructure you control.</Card.Description
            >
            <p class="pt-4 text-3xl font-semibold">$0</p>
          </Card.Header>
          <Card.Content class="flex-1 space-y-3 text-sm">
            <p class="flex gap-2">
              <IconCheck class="text-primary mt-0.5 size-4" />No cloud account
            </p>
            <p class="flex gap-2">
              <IconCheck class="text-primary mt-0.5 size-4" />OpenTelemetry ingest
            </p>
            <p class="flex gap-2">
              <IconCheck class="text-primary mt-0.5 size-4" />AGPL-3.0 source
            </p>
          </Card.Content>
          <Card.Footer>
            <Button
              href="https://github.com/orvo-sh/orvo"
              target="_blank"
              rel="noreferrer"
              variant="outline"
              class="w-full"
            >
              View source
            </Button>
          </Card.Footer>
        </Card.Root>

        <Card.Root class="ring-primary/20 border-primary/30 relative shadow-none ring-2">
          <Badge class="absolute -top-3 left-5 rounded-full">Most teams</Badge>
          <Card.Header>
            <span
              class="bg-primary/10 text-primary mb-4 flex size-9 items-center justify-center rounded-lg"
            >
              <IconDatabase class="size-4" />
            </span>
            <Card.Title class="text-lg">Pro</Card.Title>
            <Card.Description
              >Managed observability for teams shipping production software.</Card.Description
            >
            <p class="pt-4 text-3xl font-semibold">
              ${PRO_PLAN.priceUsd}<span class="text-muted-foreground ml-1 text-sm font-normal"
                >/ month</span
              >
            </p>
          </Card.Header>
          <Card.Content class="flex-1 space-y-3 text-sm">
            {#each proFeatures as feature (feature)}
              <p class="flex gap-2">
                <IconCheck class="text-primary mt-0.5 size-4 shrink-0" />{feature}
              </p>
            {/each}
          </Card.Content>
          <Card.Footer>
            <Button href="https://app.orvo.sh/sign-up" class="w-full">Start free trial</Button>
          </Card.Footer>
        </Card.Root>

        <Card.Root class="shadow-none">
          <Card.Header>
            <span
              class="bg-muted text-muted-foreground mb-4 flex size-9 items-center justify-center rounded-lg"
            >
              <IconSparkles class="size-4" />
            </span>
            <Card.Title class="text-lg">Enterprise</Card.Title>
            <Card.Description
              >Custom scale, controls, procurement, and priority support.</Card.Description
            >
            <p class="pt-4 text-3xl font-semibold">Custom</p>
          </Card.Header>
          <Card.Content class="flex-1 space-y-3 text-sm">
            <p class="flex gap-2">
              <IconCheck class="text-primary mt-0.5 size-4" />Custom ingest and retention
            </p>
            <p class="flex gap-2">
              <IconCheck class="text-primary mt-0.5 size-4" />Security review support
            </p>
            <p class="flex gap-2">
              <IconCheck class="text-primary mt-0.5 size-4" />Priority support
            </p>
          </Card.Content>
          <Card.Footer>
            <Button href="mailto:team@orvo.sh" variant="outline" class="w-full">Contact us</Button>
          </Card.Footer>
        </Card.Root>
      </div>
    </div>
  </section>

  <section class="py-16 md:py-24">
    <div class="mx-auto grid w-full max-w-6xl gap-10 px-3 md:px-6 lg:grid-cols-[0.65fr_1fr]">
      <div>
        <p class="text-primary text-xs font-medium tracking-[0.16em] uppercase">Questions</p>
        <h2 class="mt-3 text-3xl font-medium tracking-tight text-balance lg:text-4xl">
          Pricing, without the fine print.
        </h2>
      </div>

      <Accordion.Root type="single" class="w-full">
        <Accordion.Item value="ingest">
          <Accordion.Trigger>What counts as telemetry ingest?</Accordion.Trigger>
          <Accordion.Content>
            Logs, traces, and metrics sent to your Orvo organization count toward the shared monthly
            ingest allowance. The estimator treats them as one combined volume.
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="overage">
          <Accordion.Trigger>What happens after the included usage?</Accordion.Trigger>
          <Accordion.Content>
            Pro includes {PRO_PLAN.includedIngestGb} GB of ingest and 1,200 Scout credits. Usage above
            those amounts is added at the rates shown in the estimator.
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="retention">
          <Accordion.Trigger>How long is telemetry retained?</Accordion.Trigger>
          <Accordion.Content>
            Pro retains logs, traces, and metrics for {PRO_PLAN.retentionDays} days. Enterprise retention
            can be customized.
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="local">
          <Accordion.Trigger>Can I run Orvo myself?</Accordion.Trigger>
          <Accordion.Content>
            Yes. Orvo Local is open source under AGPL-3.0 and can run without an Orvo cloud account.
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  </section>
</main>
