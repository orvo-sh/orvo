<script lang="ts">
  import { OrvoLogo } from '@repo/components/icons/orvo-logo';
  import * as Accordion from '@repo/components/ui/accordion';
  import { Badge } from '@repo/components/ui/badge';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import * as Tabs from '@repo/components/ui/tabs';
  import {
    IconArrowRight,
    IconBinaryTree2,
    IconBolt,
    IconSearch,
    IconServer2
  } from '@tabler/icons-svelte';

  const problemCards = [
    'Customers report failures before you do.',
    'Logs are scattered across multiple systems.',
    'Scheduled jobs silently stop running.'
  ];

  const steps = [
    {
      title: 'Send telemetry',
      body: 'Instrument once with OpenTelemetry and start shipping logs, traces, and job signals into one workflow.',
      image: '/screenshots/overview.png',
      alt: 'Orvo overview screenshot'
    },
    {
      title: 'Detect issues',
      body: 'Filter noisy streams down to the failures that matter with live queries and focused signal views.',
      image: '/screenshots/logs.png',
      alt: 'Orvo logs screenshot'
    },
    {
      title: 'Resolve faster',
      body: 'Move from a failing request to the exact service path or missed job without jumping between tools.',
      image: '/screenshots/traces.png',
      alt: 'Orvo traces screenshot'
    }
  ];

  const teamCards = [
    'No Kubernetes required',
    'No observability team required',
    'OpenTelemetry native',
    'Deploy in minutes'
  ];

  const pricingCards = [
    {
      name: 'Starter',
      description: 'For small production workloads getting their first signal pipeline in place.',
      price: 'Free to start',
      cta: 'Start free trial',
      primary: true
    },
    {
      name: 'Pro',
      description:
        'For growing teams that need longer retention, more volume, and better shared visibility.',
      price: 'Talk to us',
      cta: 'View pricing',
      primary: false
    },
    {
      name: 'Enterprise',
      description:
        'For larger deployments that need custom limits, support, and deployment guidance.',
      price: 'Custom',
      cta: 'Contact sales',
      primary: false
    }
  ];

  const faqs = [
    {
      value: 'opentelemetry',
      question: 'Does Orvo work with OpenTelemetry?',
      answer:
        'Yes. Orvo is built around OpenTelemetry-first ingestion so you can ship telemetry from the SDKs and pipelines you already use.'
    },
    {
      value: 'retention',
      question: 'How long is data retained?',
      answer:
        'Retention depends on plan and signal type. The site keeps the pricing and plan language intentionally lightweight for now, but the product supports plan-based retention controls.'
    },
    {
      value: 'pricing',
      question: 'How is pricing structured?',
      answer:
        'Pricing is volume-oriented and intended to stay simple for small teams. This first pass keeps the page minimal, with fuller pricing detail linked separately.'
    },
    {
      value: 'self-hosting',
      question: 'Do you support self-hosting?',
      answer:
        'Not on this draft landing page. If self-hosting becomes part of the public offer, the FAQ can expand with concrete deployment guidance.'
    },
    {
      value: 'integrations',
      question: 'What integrations are available?',
      answer:
        'The core integration surface is OpenTelemetry plus webhook-based alerting and job monitoring. More integration detail can be added once the docs structure is finalized.'
    }
  ];

  const productTabs = [
    {
      value: 'logs',
      label: 'Logs',
      title: 'Search production logs without context switching.',
      image: '/screenshots/logs.png',
      alt: 'Logs product screenshot'
    },
    {
      value: 'traces',
      label: 'Traces',
      title: 'Follow request paths and isolate slow or failing services.',
      image: '/screenshots/traces.png',
      alt: 'Traces product screenshot'
    },
    {
      value: 'heartbeats',
      label: 'Heartbeats',
      title: 'Watch cron jobs and workers with simple failure visibility.',
      image: '/screenshots/heartbeats.png',
      alt: 'Heartbeats product screenshot'
    }
  ];
</script>

<svelte:head>
  <title>Orvo</title>
  <meta
    name="description"
    content="Logs, traces, and heartbeats for small teams. Understand failures, investigate incidents, and monitor critical jobs in minutes."
  />
</svelte:head>

<div class="text-foreground min-h-screen">
  <header class="border-border/70 bg-background/88 sticky top-0 z-30 border-b backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
      <a href="#top" class="flex items-center gap-3 font-medium tracking-tight">
        <OrvoLogo class="size-7 rounded-md" />
        <span>Orvo</span>
      </a>

      <nav class="text-muted-foreground hidden items-center gap-8 text-sm md:flex">
        <a href="#features" class="hover:text-foreground transition-colors">Features</a>
        <a href="#pricing" class="hover:text-foreground transition-colors">Pricing</a>
        <a href="https://orvo.sh/docs" class="hover:text-foreground transition-colors">Docs</a>
      </nav>

      <div class="flex items-center gap-2">
        <Button href="https://app.orvo.sh/sign-in" variant="ghost" class="hidden sm:inline-flex">
          Sign in
        </Button>
        <Button href="https://app.orvo.sh/sign-up" class="shadow-sm">Start free trial</Button>
      </div>
    </div>
  </header>

  <main id="top">
    <section class="px-6 pt-18 pb-10 lg:px-8 lg:pt-24">
      <div class="mx-auto max-w-7xl">
        <div class="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            class="rounded-full px-3 py-1 text-[0.72rem] tracking-[0.16em] uppercase"
          >
            OpenTelemetry native
          </Badge>
          <h1
            class="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
          >
            Know when production breaks.
          </h1>
          <p class="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-8 text-balance">
            Logs, traces and heartbeats for small teams. Understand failures, investigate incidents
            and monitor critical jobs in minutes.
          </p>
          <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="https://app.orvo.sh/sign-up" size="lg" class="min-w-44 shadow-sm">
              Start free trial
            </Button>
            <Button href="https://orvo.sh/docs" size="lg" variant="outline" class="min-w-44">
              View documentation
            </Button>
          </div>
        </div>

        <div
          class="border-border/80 bg-card mt-14 rounded-[1.75rem] border p-3 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.35)] sm:p-4"
        >
          <div class="border-border/80 bg-muted/30 overflow-hidden rounded-[1.25rem] border">
            <img
              src="/screenshots/overview.png"
              alt="Orvo overview product screenshot"
              class="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="px-6 py-20 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="max-w-2xl">
          <p class="text-primary text-sm font-medium">The problem</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Most teams discover issues too late.
          </h2>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-3">
          {#each problemCards as card}
            <Card.Root class="border-border/80 bg-card/95 rounded-2xl p-6 shadow-none">
              <Card.Content class="text-foreground/88 p-0 text-base leading-7">
                {card}
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      </div>
    </section>

    <section id="features" class="px-6 py-20 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="flex max-w-2xl items-end justify-between gap-6">
          <div>
            <p class="text-primary text-sm font-medium">How it works</p>
            <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              From telemetry to answers.
            </h2>
          </div>
        </div>

        <div class="mt-8 grid gap-4 lg:grid-cols-3">
          {#each steps as step, index}
            <Card.Root
              class="border-border/80 bg-card overflow-hidden rounded-[1.5rem] p-0 shadow-none"
            >
              <Card.Header class="border-border/70 gap-3 border-b px-5 py-5">
                <div class="text-muted-foreground flex items-center gap-3 text-sm">
                  <span
                    class="border-border bg-muted text-foreground flex size-7 items-center justify-center rounded-full border"
                  >
                    {index + 1}
                  </span>
                  Step {index + 1}
                </div>
                <Card.Title class="text-xl">{step.title}</Card.Title>
                <Card.Description class="text-sm leading-6">
                  {step.body}
                </Card.Description>
              </Card.Header>
              <Card.Content class="bg-muted/35 p-3">
                <div class="border-border/70 bg-background overflow-hidden rounded-xl border">
                  <img src={step.image} alt={step.alt} class="h-auto w-full" />
                </div>
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      </div>
    </section>

    <section class="px-6 py-20 lg:px-8">
      <div class="mx-auto grid max-w-7xl gap-12">
        <div class="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div class="max-w-xl">
            <p class="text-primary text-sm font-medium">Logs</p>
            <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Find failures instantly.
            </h2>
            <p class="text-muted-foreground mt-4 text-base leading-7">
              Search and filter logs across your applications from one place.
            </p>
          </div>
          <div class="border-border/80 bg-card rounded-[1.5rem] border p-3 shadow-none">
            <div class="border-border/70 overflow-hidden rounded-[1rem] border">
              <img src="/screenshots/logs.png" alt="Orvo logs screen" class="w-full" />
            </div>
          </div>
        </div>

        <div class="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div class="max-w-xl">
            <p class="text-primary text-sm font-medium">Traces</p>
            <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Understand where time is spent.
            </h2>
            <p class="text-muted-foreground mt-4 text-base leading-7">
              Visualize requests across services and identify bottlenecks.
            </p>
          </div>
          <div class="border-border/80 bg-card rounded-[1.5rem] border p-3 shadow-none">
            <div class="border-border/70 overflow-hidden rounded-[1rem] border">
              <img src="/screenshots/traces.png" alt="Orvo traces screen" class="w-full" />
            </div>
          </div>
        </div>

        <div class="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div class="max-w-xl">
            <p class="text-primary text-sm font-medium">Heartbeats</p>
            <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Know when critical jobs stop running.
            </h2>
            <p class="text-muted-foreground mt-4 text-base leading-7">
              Monitor cron jobs, workers and scheduled tasks.
            </p>
          </div>
          <div class="border-border/80 bg-card rounded-[1.5rem] border p-3 shadow-none">
            <div class="border-border/70 overflow-hidden rounded-[1rem] border">
              <img src="/screenshots/heartbeats.png" alt="Orvo heartbeats screen" class="w-full" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="px-6 py-20 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="max-w-2xl">
          <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">
            Observability without the complexity.
          </h2>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card.Root class="border-border/80 bg-card/95 rounded-2xl p-6 shadow-none">
            <Card.Content class="flex items-start gap-4 p-0">
              <IconServer2 class="text-primary mt-0.5 size-5" />
              <span class="leading-7">{teamCards[0]}</span>
            </Card.Content>
          </Card.Root>
          <Card.Root class="border-border/80 bg-card/95 rounded-2xl p-6 shadow-none">
            <Card.Content class="flex items-start gap-4 p-0">
              <IconSearch class="text-primary mt-0.5 size-5" />
              <span class="leading-7">{teamCards[1]}</span>
            </Card.Content>
          </Card.Root>
          <Card.Root class="border-border/80 bg-card/95 rounded-2xl p-6 shadow-none">
            <Card.Content class="flex items-start gap-4 p-0">
              <IconBinaryTree2 class="text-primary mt-0.5 size-5" />
              <span class="leading-7">{teamCards[2]}</span>
            </Card.Content>
          </Card.Root>
          <Card.Root class="border-border/80 bg-card/95 rounded-2xl p-6 shadow-none">
            <Card.Content class="flex items-start gap-4 p-0">
              <IconBolt class="text-primary mt-0.5 size-5" />
              <span class="leading-7">{teamCards[3]}</span>
            </Card.Content>
          </Card.Root>
        </div>
      </div>
    </section>

    <section class="px-6 py-20 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="max-w-2xl">
          <p class="text-primary text-sm font-medium">Product tour</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Move through the product without losing context.
          </h2>
        </div>

        <Tabs.Root value="logs" class="mt-8">
          <Tabs.List
            class="border-border/80 bg-card h-auto w-full flex-wrap justify-start rounded-2xl border p-1 md:w-fit"
          >
            {#each productTabs as tab}
              <Tabs.Trigger value={tab.value} class="rounded-xl px-4 py-2">
                {tab.label}
              </Tabs.Trigger>
            {/each}
          </Tabs.List>

          {#each productTabs as tab}
            <Tabs.Content value={tab.value} class="mt-4">
              <div class="border-border/80 bg-card rounded-[1.75rem] border p-3">
                <div
                  class="border-border/70 text-muted-foreground flex items-center justify-between border-b px-4 py-3 text-sm"
                >
                  <span>{tab.title}</span>
                  <span class="hidden md:inline">Real Orvo product screen</span>
                </div>
                <div class="overflow-hidden rounded-b-[1.2rem]">
                  <img src={tab.image} alt={tab.alt} class="w-full" />
                </div>
              </div>
            </Tabs.Content>
          {/each}
        </Tabs.Root>
      </div>
    </section>

    <section id="pricing" class="px-6 py-20 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="max-w-2xl">
          <p class="text-primary text-sm font-medium">Pricing</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Pricing that stays readable.
          </h2>
        </div>

        <div class="mt-8 grid gap-4 lg:grid-cols-3">
          {#each pricingCards as plan}
            <Card.Root class="border-border/80 bg-card rounded-[1.5rem] p-0 shadow-none">
              <Card.Header class="gap-3 px-6 pt-6">
                <Card.Title class="text-xl">{plan.name}</Card.Title>
                <Card.Description class="min-h-16 text-sm leading-6">
                  {plan.description}
                </Card.Description>
              </Card.Header>
              <Card.Content class="px-6 pb-6">
                <div class="text-3xl font-semibold tracking-tight">{plan.price}</div>
                <Button
                  href={plan.primary ? 'https://app.orvo.sh/sign-up' : 'https://orvo.sh/pricing'}
                  variant={plan.primary ? 'default' : 'outline'}
                  class="mt-6 w-full"
                >
                  {plan.cta}
                </Button>
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      </div>
    </section>

    <section class="px-6 py-20 lg:px-8">
      <div class="mx-auto max-w-4xl">
        <div class="max-w-2xl">
          <p class="text-primary text-sm font-medium">FAQ</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Questions teams ask before they switch.
          </h2>
        </div>

        <Accordion.Root
          type="single"
          class="border-border/80 bg-card mt-8 rounded-[1.5rem] border px-6"
        >
          {#each faqs as faq}
            <Accordion.Item value={faq.value} class="border-border/70">
              <Accordion.Trigger class="py-5 text-left text-base font-medium">
                {faq.question}
              </Accordion.Trigger>
              <Accordion.Content class="text-muted-foreground pb-5 text-sm leading-7">
                {faq.answer}
              </Accordion.Content>
            </Accordion.Item>
          {/each}
        </Accordion.Root>
      </div>
    </section>

    <section class="px-6 pt-4 pb-24 lg:px-8">
      <div
        class="border-border/80 bg-card mx-auto max-w-5xl rounded-[2rem] border px-8 py-14 text-center shadow-none"
      >
        <Badge variant="outline" class="rounded-full px-3 py-1">Production-ready by design</Badge>
        <h2 class="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
          Start monitoring production today.
        </h2>
        <p class="text-muted-foreground mx-auto mt-4 max-w-2xl text-base leading-7">
          Ship telemetry, inspect failures, and keep critical jobs visible without building a full
          observability stack around them.
        </p>
        <div class="mt-8 flex justify-center">
          <Button href="https://app.orvo.sh/sign-up" size="lg" class="min-w-48">
            Start free trial
            <IconArrowRight data-slot="button-icon" />
          </Button>
        </div>
      </div>
    </section>
  </main>
</div>
