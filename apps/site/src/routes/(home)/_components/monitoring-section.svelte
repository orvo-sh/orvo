<script>
  import FeaturesSectionAlertsIncidentsCard from './features-section/features-section-alerts-incidents-card.svelte';
  import FeaturesSectionHeartbeatsCard from './features-section/features-section-heartbeats-card.svelte';
  import FeaturesSectionHostMonitoringCard from './features-section/features-section-host-monitoring-card.svelte';
  import FeaturesSectionNotificationsCard from './features-section/features-section-notifications-card.svelte';
</script>

<section
  id="monitoring"
  class="border-foreground/10 from-background via-muted/20 to-background border-b bg-linear-to-b py-16 md:py-24"
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-3 md:px-6">
    <div class="space-y-3">
      <h2 class="max-w-xl text-3xl font-medium tracking-tight text-balance lg:text-4xl">
        Know when production needs you.
      </h2>
      <p class="text-secondary-foreground max-w-150 text-lg leading-relaxed">
        Watch your hosts and scheduled work. Catch issues with alerts, and notify your team where
        they work.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-12">
      <FeaturesSectionHostMonitoringCard />
      <FeaturesSectionHeartbeatsCard />
      <div class="grid items-start gap-6 md:col-span-12 md:grid-cols-2">
        <FeaturesSectionAlertsIncidentsCard />
        <FeaturesSectionNotificationsCard />
      </div>
    </div>
  </div>
</section>
