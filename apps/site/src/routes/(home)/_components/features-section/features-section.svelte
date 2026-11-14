<script>
  import LogsCard from './logs-card.svelte';
  import MetricsCard from './metrics-card.svelte';
  import TracesCard from './traces-card.svelte';
</script>

<section
  id="features"
  class="border-foreground/10 from-background via-muted/20 to-background bg-linear-to-b py-16 md:py-24"
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-3 md:px-6">
    <div class=" space-y-3">
      <h2 class="max-w-xl text-3xl font-medium tracking-tight text-balance lg:text-4xl">
        Everything starts with your telemetry.
      </h2>

      <p class="text-secondary-foreground max-w-150 text-lg leading-relaxed">
        Bring your logs, metrics, and traces together in one place. Explore what's happening across
        your services .
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-12">
      <LogsCard />

      <MetricsCard />

      <TracesCard />
      <div class="hidden md:col-span-4 md:block" aria-hidden="true"></div>
    </div>
  </div>
</section>
