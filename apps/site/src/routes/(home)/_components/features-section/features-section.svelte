<script>
  import { AspectRatio } from '@repo/components/ui/aspect-ratio';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '@repo/components/ui/card';
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

      <Card class="bg-card/90 border-foreground/10 xl:col-span-3">
        <CardHeader class="gap-2 px-5 pt-5">
          <p class="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
            Alerts
          </p>
          <CardTitle class="text-xl">Only what matters.</CardTitle>
          <CardDescription class="text-sm leading-6">
            Alert detail should tell you what fired, why, and who needs to look.
          </CardDescription>
        </CardHeader>
        <CardContent class="px-5 pb-5">
          <AspectRatio ratio={4 / 5}>
            <img
              src={placeholderImage}
              alt="Portrait screenshot of an Orvo alert detail view showing condition thresholds, recent evaluations, severity, and notification routing."
              width="960"
              height="1200"
              class="border-foreground/10 h-full w-full rounded-xl border object-cover shadow-sm"
            />
          </AspectRatio>
        </CardContent>
      </Card>

      <Card class="bg-card/90 border-foreground/10 xl:col-span-8">
        <CardHeader class="gap-2 px-5 pt-5">
          <p class="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
            Incidents
          </p>
          <CardTitle class="text-xl sm:text-2xl">Keep the investigation moving.</CardTitle>
          <CardDescription class="max-w-xl text-sm leading-6">
            Timeline, responders, affected services, and evidence stay attached to the incident.
          </CardDescription>
        </CardHeader>
        <CardContent class="px-5 pb-5">
          <AspectRatio ratio={16 / 9}>
            <img
              src={placeholderImage}
              alt="Large screenshot of an Orvo incident page with an investigation timeline, linked alerts, impacted services, notes, and current status."
              width="1600"
              height="900"
              class="border-foreground/10 h-full w-full rounded-xl border object-cover shadow-sm"
            />
          </AspectRatio>
        </CardContent>
      </Card>

      <Card class="bg-card/90 border-foreground/10 xl:col-span-4">
        <CardHeader class="gap-2 px-5 pt-5">
          <p class="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">Hosts</p>
          <CardTitle class="text-xl">Read the machine.</CardTitle>
          <CardDescription class="text-sm leading-6">
            CPU, memory, disk, and network stay close enough to compare at a glance.
          </CardDescription>
        </CardHeader>
        <CardContent class="px-5 pb-5">
          <AspectRatio ratio={1}>
            <img
              src={placeholderImage}
              alt="Square screenshot of Orvo host monitoring with CPU, memory, disk, and network charts alongside host health summaries."
              width="1200"
              height="1200"
              class="border-foreground/10 h-full w-full rounded-xl border object-cover shadow-sm"
            />
          </AspectRatio>
        </CardContent>
      </Card>

      <Card class="bg-card/90 border-foreground/10 md:col-span-2 xl:col-span-4">
        <CardHeader class="gap-2 px-5 pt-5">
          <p class="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
            Deployments
          </p>
          <CardTitle class="text-xl">Changes have context.</CardTitle>
          <CardDescription class="text-sm leading-6">
            Line releases up with regressions before the blame game starts.
          </CardDescription>
        </CardHeader>
        <CardContent class="px-5 pb-5">
          <AspectRatio ratio={16 / 9}>
            <img
              src={placeholderImage}
              alt="Wide screenshot of an Orvo deployment timeline correlating releases with service health, latency changes, and production events."
              width="1600"
              height="900"
              class="border-foreground/10 h-full w-full rounded-xl border object-cover shadow-sm"
            />
          </AspectRatio>
        </CardContent>
      </Card>
    </div>
  </div>
</section>
