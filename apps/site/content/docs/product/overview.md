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

Use [Hosts](/docs/product/hosts) to monitor CPU, memory, filesystem utilization, load, and reporting status for Linux servers running Orvo Agent.

### Scout

Use [Scout](/docs/product/scout) to investigate the current app in plain language or make approved changes to alerts, heartbeats, incidents, and app settings.

### Deployment context

Add release metadata to your telemetry so you can compare behavior before and after a [deployment](/docs/product/deployments).

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
