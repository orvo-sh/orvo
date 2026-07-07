---
title: Product overview
description: Understand the main areas of Orvo.
order: 1
previous: opentelemetry/collector
next: product/logs
---
# Product overview

Orvo is organized around the way developers investigate production, not around a giant list of platform features.

## The main product areas

### Logs

Use [Logs](/docs/product/logs) when you need the exact event, message, or attribute around a failure.

### Traces

Use [Traces](/docs/product/traces) when you need to see how a request or job moved through your system and where time or errors were introduced.

### Metrics

Use [Metrics](/docs/product/metrics) when you need to know whether a problem is isolated, widespread, rising, or improving.

### Alerts

Use [Alerts](/docs/product/alerts) when the product should notify you before a customer has to.

### Heartbeats

Use [Heartbeats](/docs/product/heartbeats) for recurring jobs, scheduled tasks, and workers that must check in on time.

### Incidents

Use [Incidents](/docs/product/incidents) to follow active problems opened by alerts or missed heartbeats.

### Hosts

Use [Hosts](/docs/product/hosts) to understand how host-level identity and infrastructure telemetry fit into the product today.

### Deployments

Use [Deployments](/docs/product/deployments) to understand how release context should show up in your telemetry, even if you are not yet relying on a dedicated deployments surface.

### Insights

Use [Insights](/docs/product/insights) to understand the kinds of changes Orvo should surface automatically and how to use the current product areas as that workflow evolves.

## A practical workflow

A common investigation flow is:

1. Open an incident or alert.
2. Search the relevant logs.
3. Jump to the trace.
4. Use metrics to judge blast radius.
5. Compare against environment or deployment context.

## Related pages

- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
- [Investigate a production incident](/docs/guides/investigate-a-production-incident)
