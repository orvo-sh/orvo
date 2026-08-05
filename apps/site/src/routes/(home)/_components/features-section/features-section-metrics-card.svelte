<script lang="ts">
  import * as Card from '@repo/components/ui/card';
  import { IconActivityHeartbeat, IconArrowUpRight } from '@tabler/icons-svelte';
  import FeaturesSectionMetricsChartCard from './features-section-metrics-chart-card.svelte';

  const latencyData = [
    { timestamp: new Date('2026-07-01T12:00:00Z'), value: 198 },
    { timestamp: new Date('2026-07-01T12:05:00Z'), value: 208 },
    { timestamp: new Date('2026-07-01T12:10:00Z'), value: 232 },
    { timestamp: new Date('2026-07-01T12:15:00Z'), value: 246 },
    { timestamp: new Date('2026-07-01T12:20:00Z'), value: 198 },
    { timestamp: new Date('2026-07-01T12:25:00Z'), value: 184 }
  ];

  const errorRateData = [
    { timestamp: new Date('2026-07-01T12:00:00Z'), value: 0.34 },
    { timestamp: new Date('2026-07-01T12:05:00Z'), value: 0.46 },
    { timestamp: new Date('2026-07-01T12:10:00Z'), value: 0.52 },
    { timestamp: new Date('2026-07-01T12:15:00Z'), value: 0.61 },
    { timestamp: new Date('2026-07-01T12:20:00Z'), value: 0.74 },
    { timestamp: new Date('2026-07-01T12:25:00Z'), value: 0.82 }
  ];
</script>

<Card.Root
  class="aspect-square justify-between gap-0 overflow-hidden p-0 shadow-none xl:col-span-6"
>
  <div class="p-5 pb-0">
    <h2 class="text-secondary-foreground flex items-center gap-2 font-sans text-lg font-medium">
      <IconActivityHeartbeat class="text-primary size-5" />
      Metrics
    </h2>
    <p class="text-muted-foreground mt-1.5 max-w-[84%] text-base leading-relaxed">
      Watch latency, throughput, and error rate shift together before an incident spreads. Compare
      broader health trends early, then move into traces or logs only when you need the deeper
      story.
      <a
        href="/docs/product/metrics"
        target="_blank"
        class="text-primary inline-flex text-base underline-offset-4 hover:underline"
      >
        Learn more about metrics
        <IconArrowUpRight class="mb-2 ml-1 inline-flex size-3.5" />
      </a>
    </p>
  </div>

  <div class="relative px-5 pt-4 pb-5">
    <div class="relative min-h-[21rem]">
      <div class="absolute top-0 right-2 z-20 w-[90%]">
        <FeaturesSectionMetricsChartCard
          title="Latency"
          data={latencyData}
          summaryValue={184}
          trend={{ change: 12.4, reverse: true }}
          valueFormatter={(value) => `${Math.round(value)} ms`}
          yDomain={[0, 260]}
          yFormat={(value) => `${Math.round(value)}ms`}
        />
      </div>

      <div class="absolute bottom-0 left-2 z-10 w-[90%] translate-y-[6%] -rotate-6">
        <FeaturesSectionMetricsChartCard
          title="Error rate"
          data={errorRateData}
          summaryValue={0.82}
          trend={{ change: 18.6 }}
          color="oklch(70.5% 0.213 47.604)"
          valueFormatter={(value) => `${value.toFixed(2)}%`}
          yDomain={[0, 1]}
          yFormat={(value) => `${value.toFixed(1)}%`}
        />
      </div>
    </div>
  </div>
</Card.Root>
