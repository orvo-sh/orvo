<script>
  import FeaturesSection from './_components/features-section/features-section.svelte';
  import HeroSection from './_components/hero-section.svelte';
  import LogsSection from './_components/logs-section.svelte';
  import PricingSection from './_components/pricing-section.svelte';
  import SignalsSection from './_components/signals-section.svelte';
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
<SignalsSection />
<LogsSection />
<PricingSection />
