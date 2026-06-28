const productFeatures = [
  {
    href: '/product/tracing',
    title: 'Tracing',
    eyebrow: 'Distributed tracing',
    summary: 'Follow requests across services and find where latency, retries, or failures begin.',
    description:
      'Trace every request path across your stack, inspect spans in context, and move from a broken flow to the exact service or dependency causing it.',
    features: [
      'End-to-end request visibility across services',
      'Span timelines with dependency context',
      'Fast isolation of latency spikes and failed hops'
    ],
    useCases: ['Debug production regressions', 'Investigate slow endpoints', 'Understand service dependencies']
  },
  {
    href: '/product/logs',
    title: 'Logs',
    eyebrow: 'Structured logs',
    summary: 'Search logs with trace context so incidents are easier to explain and fix.',
    description:
      'Centralize application and infrastructure logs, keep them connected to traces, and move from a symptom to the exact event stream behind it.',
    features: [
      'Centralized log ingestion and search',
      'Correlation with traces and app context',
      'High-signal debugging without tab switching'
    ],
    useCases: ['Triage incidents faster', 'Inspect deploy errors', 'Track noisy failure patterns']
  },
  {
    href: '/product/metrics',
    title: 'Metrics',
    eyebrow: 'Time-series metrics',
    summary: 'Watch the health of services, workloads, and dependencies without stitching tools together.',
    description:
      'Track throughput, latency, error rates, and infrastructure behavior in one place so teams can understand overall system health before incidents expand.',
    features: [
      'Service and infrastructure health at a glance',
      'Shared view of performance and capacity signals',
      'Built to work alongside traces and logs'
    ],
    useCases: ['Track latency and error rate', 'Spot capacity issues early', 'Monitor deploy impact']
  },
  {
    href: '/product/alerts',
    title: 'Alerts',
    eyebrow: 'Actionable alerting',
    summary: 'Turn signal changes into notifications that point to the right place to investigate.',
    description:
      'Create alerting around the signals that matter, reduce blind thresholds, and route teams toward the app, container, or trace context behind the issue.',
    features: [
      'Alerting tied to real operational signals',
      'Context that reduces noisy escalation loops',
      'Faster handoff from detection to diagnosis'
    ],
    useCases: ['Catch failures earlier', 'Reduce noisy incident response', 'Route issues to the right owners']
  },
  {
    href: '/product/heartbeats',
    title: 'Heartbeats',
    eyebrow: 'Job and uptime checks',
    summary: 'Know when scheduled work stops running or external checks start failing.',
    description:
      'Monitor recurring jobs, cron flows, and expected pings so silent failures become visible before customers notice missing work.',
    features: [
      'Heartbeat monitoring for jobs and services',
      'Fast detection of missing or late executions',
      'Simple coverage for expected background activity'
    ],
    useCases: ['Watch cron jobs', 'Track background workers', 'Confirm external uptime checks']
  }
] as const;

const productFeatureByPath = Object.fromEntries(
  productFeatures.map((feature) => [feature.href, feature])
) as Record<string, (typeof productFeatures)[number]>;

export { productFeatureByPath, productFeatures };
