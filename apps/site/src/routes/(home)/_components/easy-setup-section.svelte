<script lang="ts">
  import { Badge } from '@repo/components/ui/badge';
  import * as Card from '@repo/components/ui/card';
  import { IconArrowRight, IconArrowUpRight, IconCheck, IconTerminal2 } from '@tabler/icons-svelte';
</script>

<section
  class="border-foreground/10 from-background via-muted/25 to-background border-b bg-linear-to-b py-16 md:py-24"
>
  <div
    class="mx-auto grid w-full max-w-6xl gap-10 px-3 md:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16"
  >
    <div>
      <p class="text-primary text-xs font-medium tracking-[0.16em] uppercase">
        Open standards underneath
      </p>
      <h2 class="mt-3 max-w-xl text-3xl font-medium tracking-tight text-balance lg:text-5xl">
        From zero to telemetry in minutes.
      </h2>
      <p class="text-secondary-foreground mt-4 max-w-xl text-base leading-relaxed text-balance">
        Orvo works with standard OpenTelemetry, so you can connect the instrumentation you already
        have or configure it yourself. The setup skill we’re building will let your coding agent
        handle the repetitive parts for you.
      </p>
      <a
        href="/docs/getting-started/send-your-first-telemetry"
        class="text-primary mt-5 inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
      >
        Configure OpenTelemetry yourself
        <IconArrowUpRight class="ml-1 size-3.5" />
      </a>
    </div>

    <Card.Root class="gap-0 overflow-hidden p-0 shadow-none">
      <div class="flex items-center justify-between gap-4 px-5 py-4">
        <div class="flex items-center gap-2.5">
          <span
            class="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md"
          >
            <IconTerminal2 class="size-4" />
          </span>
          <div>
            <p class="text-secondary-foreground text-sm font-medium">Orvo setup skill</p>
            <p class="text-muted-foreground text-xs">Agent-assisted OpenTelemetry setup</p>
          </div>
        </div>
        <Badge variant="secondary" class="rounded-full">In development</Badge>
      </div>

      <div class="border-border/70 bg-muted/30 border-y p-4 sm:p-5">
        <div class="bg-background rounded-lg border p-3.5 font-mono text-xs leading-relaxed">
          <span class="text-primary">›</span> Add Orvo observability to this project
        </div>

        <div class="mt-4 grid gap-2">
          {#each [['Project inspected', 'SvelteKit · Node.js'], ['OpenTelemetry configured', 'standard SDK and auto-instrumentation'], ['OTLP export connected', 'https://ingest.orvo.sh'], ['Telemetry verified', 'checkout-api · production']] as step (step[0])}
            <div
              class="bg-background flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <span
                class="bg-primary/10 flex size-5 shrink-0 items-center justify-center rounded-full"
              >
                <IconCheck class="text-primary size-3" />
              </span>
              <span class="text-secondary-foreground text-sm font-medium">{step[0]}</span>
              <span
                class="text-muted-foreground ml-auto hidden min-w-0 truncate font-mono text-xs sm:block"
              >
                {step[1]}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <div
        class="text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-3.5 font-mono text-xs"
      >
        <span>Your project</span>
        <IconArrowRight class="size-3.5" />
        <span class="text-secondary-foreground">OpenTelemetry</span>
        <IconArrowRight class="size-3.5" />
        <span class="text-primary">Orvo</span>
      </div>
    </Card.Root>
  </div>
</section>
