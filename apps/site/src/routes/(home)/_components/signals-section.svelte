<script lang="ts">
  import { Badge } from '@repo/components/ui/badge';
  import { Button } from '@repo/components/ui/button';
  import * as Card from '@repo/components/ui/card';
  import {
    IconArrowUpRight,
    IconBrandGithub,
    IconCheck,
    IconCloud,
    IconCode,
    IconDatabase,
    IconDeviceDesktop,
    IconLockOpen,
    IconTerminal2
  } from '@tabler/icons-svelte';

  const localDetails = [
    { icon: IconDeviceDesktop, label: 'Dashboard on localhost' },
    { icon: IconDatabase, label: 'Data stays on your machine' },
    { icon: IconCloud, label: 'OTLP HTTP ingest included' }
  ];
</script>

<section id="open-source" class="border-foreground/10 bg-background border-b py-16 md:py-24">
  <div class="mx-auto w-full max-w-6xl px-3 md:px-6">
    <div class="max-w-2xl space-y-3">
      <p class="text-primary text-xs font-medium tracking-[0.16em] uppercase">Own the stack</p>
      <h2 class="text-3xl font-medium tracking-tight text-balance lg:text-5xl">
        Open by default. Local when you want it.
      </h2>
      <p class="text-secondary-foreground text-base leading-loose text-balance">
        Orvo is built in public and speaks OpenTelemetry, so your instrumentation and your data do
        not have to become someone else’s lock-in.
      </p>
    </div>

    <div class="mt-10 grid gap-6 lg:grid-cols-2">
      <Card.Root class="bg-muted/25 gap-0 overflow-hidden p-0 shadow-none">
        <Card.Header class="p-6 pb-4">
          <div class="flex items-start justify-between gap-4">
            <span
              class="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg"
            >
              <IconBrandGithub class="size-5" />
            </span>
            <Badge variant="outline" class="rounded-full">AGPL-3.0</Badge>
          </div>
          <Card.Title class="mt-7 text-2xl">The source is part of the product.</Card.Title>
          <Card.Description class="mt-2 text-base leading-relaxed">
            Read every line, follow development, open an issue, or run the stack on infrastructure
            you control. No proprietary collector stands between your services and your telemetry.
          </Card.Description>
        </Card.Header>
        <Card.Content class="mt-auto grid gap-3 px-6 pb-6 text-sm">
          <p class="flex items-center gap-2">
            <IconCheck class="text-primary size-4" /> Public roadmap and development
          </p>
          <p class="flex items-center gap-2">
            <IconCheck class="text-primary size-4" /> OpenTelemetry-native ingestion
          </p>
          <p class="flex items-center gap-2">
            <IconCheck class="text-primary size-4" /> Self-hostable under AGPL-3.0
          </p>
        </Card.Content>
        <Card.Footer class="border-border/70 bg-background/70 border-t px-6 py-4">
          <Button
            href="https://github.com/orvo-sh/orvo"
            target="_blank"
            rel="noreferrer"
            variant="outline"
          >
            <IconBrandGithub data-slot="button-icon" />
            Read the source
            <IconArrowUpRight data-slot="button-icon" />
          </Button>
        </Card.Footer>
      </Card.Root>

      <Card.Root class="gap-0 overflow-hidden p-0 shadow-none">
        <Card.Header class="p-6 pb-4">
          <div class="flex items-start justify-between gap-4">
            <span
              class="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg"
            >
              <IconTerminal2 class="size-5" />
            </span>
            <Badge variant="outline" class="rounded-full">In development</Badge>
          </div>
          <Card.Title class="mt-7 text-2xl">Orvo Local</Card.Title>
          <Card.Description class="mt-2 text-base leading-relaxed">
            A local-first runtime for the full Orvo experience: the dashboard, control data, and
            ingestion together, without creating a cloud account.
          </Card.Description>
        </Card.Header>
        <Card.Content class="px-6 pb-6">
          <div
            class="bg-foreground text-background overflow-hidden rounded-lg font-mono text-sm shadow-sm"
          >
            <div
              class="border-background/10 text-background/55 flex items-center gap-2 border-b px-4 py-2.5 text-xs"
            >
              <IconCode class="size-3.5" />
              terminal
            </div>
            <div class="space-y-2 px-4 py-4">
              <p><span class="text-background/45">$</span> orvo start</p>
              <p class="text-background/55">Orvo Local is ready</p>
              <p class="text-background/75">Dashboard&nbsp; http://127.0.0.1:4173</p>
              <p class="text-background/75">OTLP HTTP&nbsp; http://127.0.0.1:4318</p>
            </div>
          </div>
          <div class="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {#each localDetails as detail (detail.label)}
              {@const Icon = detail.icon}
              <div class="bg-muted/45 flex items-center gap-2 rounded-md p-2.5 text-xs">
                <Icon class="text-muted-foreground size-3.5 shrink-0" />
                <span>{detail.label}</span>
              </div>
            {/each}
          </div>
        </Card.Content>
        <Card.Footer class="border-border/70 bg-muted/20 mt-auto border-t px-6 py-4 text-sm">
          <IconLockOpen class="text-primary mr-2 size-4" />
          Follow the work in the public repository.
        </Card.Footer>
      </Card.Root>
    </div>

    <div
      class="mt-6 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="font-medium">Already using OpenTelemetry?</p>
        <p class="text-muted-foreground mt-1 text-sm">
          Point your OTLP exporter at Orvo. Keep the instrumentation you already own.
        </p>
      </div>
      <Button
        href="/docs/getting-started/send-your-first-telemetry"
        variant="outline"
        class="shrink-0"
      >
        Send your first signal
        <IconArrowUpRight data-slot="button-icon" />
      </Button>
    </div>
  </div>
</section>
