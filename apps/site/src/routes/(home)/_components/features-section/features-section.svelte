<script>
  import FeaturesSectionAlertsIncidentsCard from './features-section-alerts-incidents-card.svelte';
  import FeaturesSectionHeartbeatsCard from './features-section-heartbeats-card.svelte';
  import FeaturesSectionLogsCard from './features-section-logs-card.svelte';
  import FeaturesSectionMcpCard from './features-section-mcp-card.svelte';
  import FeaturesSectionMetricsCard from './features-section-metrics-card.svelte';
  import FeaturesSectionScoutCard from './features-section-scout-card.svelte';
  import FeaturesSectionTracesCard from './features-section-traces-card.svelte';
</script>

<section
  id="features"
  class="border-foreground/10 from-background via-muted/20 to-background border-b bg-linear-to-b py-16 md:py-24"
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-3 md:px-6">
    <div class="max-w-2xl space-y-3">
      <h2 class="max-w-xl text-3xl font-medium tracking-tight text-balance lg:text-4xl">
        One platform. Every signal.
      </h2>
      <p class="text-secondary-foreground text-base leading-loose text-balance">
        Follow what changed, where it spread, and what needs attention without bouncing between
        tools.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      <FeaturesSectionLogsCard />

      <FeaturesSectionMetricsCard />

      <FeaturesSectionTracesCard />

      <FeaturesSectionHeartbeatsCard />

      <FeaturesSectionAlertsIncidentsCard />

      <FeaturesSectionScoutCard />

      <FeaturesSectionMcpCard />
    </div>
  </div>
</section>
