---
title: Metrics
description: Track numeric signals from your applications and infrastructure.
order: 4
previous: product/traces
next: product/alerts
---
# Metrics

Metrics tell you whether a problem is isolated or systemic.

## What is it?

Orvo's metrics explorer lets you query numeric signals over time, choose an aggregation, and group results by dimensions such as service or environment.

The current metrics service supports aggregations including:

- `p50`
- `p95`
- `p99`
- `avg`
- `min`
- `max`
- `count`
- `rate_per_sec`
- `rate_per_min`
- `increase`
- `total`
- `current`

## When to use it

Use metrics when you need to answer:

- Are errors rising or stable?
- Did latency get worse for everyone or only one service?
- Is throughput dropping?
- Are container signals going stale?

## How it works in Orvo

Today, metrics can be grouped by:

- no grouping
- metric
- service
- environment

This is especially useful for comparing one unhealthy service against the rest of the system.

## Metrics vs logs and traces

Use metrics first when the question is about trend or blast radius.
Use logs first when you need exact event details.
Use traces first when you need execution timing.

In practice, strong investigations use all three.

## Common workflows

### Check release health

Look at p95 latency, throughput, and error-related metrics before and after a change.

### Confirm blast radius

If checkout errors rise, compare metrics by service to see whether the problem is isolated to `checkout-api` or visible across other services too.

### Watch infrastructure-related signals

Container CPU, container memory, and stale reporting metrics are useful inputs for [Alerts](/docs/product/alerts).

## Best practices

- Use stable metric names.
- Keep service and environment labels consistent.
- Treat metrics as summary signal, not full explanation.
- Follow spikes back to logs and traces quickly.

## Related pages

- [Alerts](/docs/product/alerts)
- [Hosts](/docs/product/hosts)
- [Track a deployment](/docs/guides/track-a-deployment)
