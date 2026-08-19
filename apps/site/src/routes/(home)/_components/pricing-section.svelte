<script lang="ts">
  import { Badge } from '@repo/components/ui/badge';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowRight, IconCheck } from '@tabler/icons-svelte';

  const plans = [
    {
      name: 'Local',
      description: 'For local development and complete ownership.',
      price: '$0',
      suffix: 'open source',
      features: [
        'Run on your own machine',
        'Logs, traces, and metrics',
        'No cloud account required'
      ],
      action: 'View on GitHub',
      href: 'https://github.com/orvo-sh/orvo',
      variant: 'outline' as const
    },
    {
      name: 'Starter',
      description: 'For small teams getting production visibility.',
      price: '$19',
      suffix: 'per month',
      features: [
        '50 GB included ingest',
        '150,000 Scout credits',
        '14-day data retention',
        'No fee for extra seats'
      ],
      action: 'Start 14-day trial',
      href: 'https://app.orvo.sh/sign-up',
      variant: 'outline' as const
    },
    {
      name: 'Pro',
      description: 'For teams shipping and investigating every day.',
      price: '$49',
      suffix: 'per month',
      features: [
        '150 GB included ingest',
        '1,200,000 Scout credits',
        '30-day data retention',
        '$0.32 per GB overage'
      ],
      action: 'Start 14-day trial',
      href: 'https://app.orvo.sh/sign-up',
      variant: 'default' as const,
      recommended: true
    }
  ];
</script>

<section id="pricing" class="border-foreground/10 bg-background border-b py-16 md:py-24">
  <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-primary text-xs font-medium tracking-[0.16em] uppercase">Pricing</p>
      <h2 class="mt-3 text-3xl font-medium tracking-tight text-balance lg:text-5xl">
        Start local. Move to the cloud when it helps.
      </h2>
      <p class="text-secondary-foreground mt-4 text-base leading-loose text-balance">
        The same observability workflow, with a managed path for teams that would rather not run the
        infrastructure themselves.
      </p>
    </div>

    <div class="mt-10 grid gap-5 lg:grid-cols-3">
      {#each plans as plan (plan.name)}
        <Card.Root
          class={plan.recommended
            ? 'border-primary/40 ring-primary/15 relative shadow-none ring-2'
            : 'shadow-none'}
        >
          {#if plan.recommended}
            <Badge class="absolute -top-3 left-5 rounded-full">Recommended</Badge>
          {/if}
          <Card.Header>
            <Card.Title>{plan.name}</Card.Title>
            <Card.Description class="min-h-10">{plan.description}</Card.Description>
            <div class="pt-4">
              <span class="text-3xl font-semibold tracking-tight">{plan.price}</span>
              <span class="text-muted-foreground ml-1 text-sm">{plan.suffix}</span>
            </div>
          </Card.Header>
          <Card.Content class="flex-1">
            <div class="grid gap-3 text-sm">
              {#each plan.features as feature (feature)}
                <p class="flex items-start gap-2.5">
                  <IconCheck class="text-primary mt-0.5 size-4 shrink-0" />
                  {feature}
                </p>
              {/each}
            </div>
          </Card.Content>
          <Card.Footer>
            <Button
              href={plan.href}
              target={plan.name === 'Local' ? '_blank' : undefined}
              rel={plan.name === 'Local' ? 'noreferrer' : undefined}
              variant={plan.variant}
              class="w-full"
            >
              {plan.action}
              <IconArrowRight data-slot="button-icon" />
            </Button>
          </Card.Footer>
        </Card.Root>
      {/each}
    </div>

    <div
      class="from-primary/10 via-primary/5 mt-16 overflow-hidden rounded-xl border bg-linear-to-br to-transparent px-6 py-10 text-center md:px-10 md:py-14"
    >
      <h2 class="text-3xl font-medium tracking-tight text-balance lg:text-4xl">
        Production will surprise you. The investigation should not.
      </h2>
      <p class="text-muted-foreground mx-auto mt-3 max-w-2xl leading-relaxed">
        Bring your OpenTelemetry data and get one place to understand what your systems are doing.
      </p>
      <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Button href="https://app.orvo.sh/sign-up" size="lg">
          Start free trial
          <IconArrowRight data-slot="button-icon" />
        </Button>
        <Button href="/docs" size="lg" variant="outline">Read the documentation</Button>
      </div>
    </div>
  </div>
</section>
