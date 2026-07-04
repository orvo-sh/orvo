<script>
  import FeaturesSectionAlertsIncidentsCard from './features-section-alerts-incidents-card.svelte';
  import FeaturesSectionHeartbeatsCard from './features-section-heartbeats-card.svelte';
  import FeaturesSectionLogsCard from './features-section-logs-card.svelte';
  import FeaturesSectionMetricsCard from './features-section-metrics-card.svelte';
  import FeaturesSectionTracesCard from './features-section-traces-card.svelte';

  const placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
      <rect width="1600" height="1000" fill="#f6f3ee" />
      <rect x="48" y="48" width="1504" height="904" rx="28" fill="#fffdfa" stroke="#e6dfd5" stroke-width="6" stroke-dasharray="18 18" />
      <text x="800" y="470" text-anchor="middle" font-family="Inter, sans-serif" font-size="42" fill="#6f675d">Replace with product screenshot</text>
      <text x="800" y="532" text-anchor="middle" font-family="Inter, sans-serif" font-size="26" fill="#9a9187">Use the alt text in this card as the capture brief</text>
    </svg>
  `)}`;
</script>

<section
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

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
      <FeaturesSectionLogsCard />

      <FeaturesSectionMetricsCard />

      <FeaturesSectionTracesCard />

      <FeaturesSectionHeartbeatsCard />

      <FeaturesSectionAlertsIncidentsCard />
    </div>
  </div>
</section>
