<script>
  import CtaSection from './_components/cta-section.svelte';
  import FeaturesSection from './_components/features-section/features-section.svelte';
  import HeroSection from './_components/hero-section.svelte';
  import ScoutSection from './_components/scout-section.svelte';
  import MonitoringSection from './_components/monitoring-section.svelte';
  import SetupSection from './_components/setup-section.svelte';
  import PlansSection from './_components/plans-section.svelte';
</script>

<svelte:head>
  <title>Orvo — Open-source observability</title>
  <meta
    name="description"
    content="Open-source observability for logs, traces, metrics, alerts, and heartbeats. Built on OpenTelemetry and available in the cloud or locally."
  />
</svelte:head>

<HeroSection />
<FeaturesSection />
<ScoutSection />
<MonitoringSection />
<SetupSection />
<PlansSection />
<CtaSection />
