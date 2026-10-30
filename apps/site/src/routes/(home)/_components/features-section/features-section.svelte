<script>
  import FeaturesSectionLogsCard from './features-section-logs-card.svelte';
  import FeaturesSectionMetricsCard from './features-section-metrics-card.svelte';
  import FeaturesSectionTracesCard from './features-section-traces-card.svelte';
</script>

<section
  id="features"
  class="border-foreground/10 from-background via-muted/20 to-background border-b bg-linear-to-b py-16 md:py-24"
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-3 md:px-6">
    <div class=" space-y-3">
      <h2 class="max-w-xl text-3xl font-medium tracking-tight text-balance lg:text-4xl">
        The whole story, in one place.
      </h2>

      <p class="text-secondary-foreground max-w-150 text-lg leading-relaxed">
        Logs, traces, metrics, and everything in between. See what happened, follow where it
        started, and understand what needs your attention.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-12">
      <FeaturesSectionLogsCard />

      <FeaturesSectionMetricsCard />

      <FeaturesSectionTracesCard />
      <div class="hidden md:col-span-4 md:block" aria-hidden="true"></div>
    </div>
  </div>
</section>
