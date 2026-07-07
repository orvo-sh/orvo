---
title: Incidents
description: Track active and resolved production issues.
order: 8
previous: product/hosts
next: product/deployments
---
# Incidents

Incidents give you one place to follow live problems instead of bouncing between alert deliveries and missed-heartbeat notifications.

## What is it?

An incident is the product record of a problem opened by either:

- an alert threshold breach
- a missed heartbeat

## When to use it

Use incidents when you need to know:

- what is open right now
- what already resolved
- what was intentionally dismissed
- which alerts or heartbeat monitors caused the issue

## How it works in Orvo

The incidents list groups events by status:

- open
- resolved
- dismissed

Each incident carries source type, severity, timestamps, and links back to the originating alert rule or heartbeat monitor.

Incident detail also links outward to related logs, traces, and metrics for the incident window.

## Common workflows

### Work from open incidents first

That gives you the shortest list of things that still need attention.

### Resolve when the signal is healthy again

Use resolve when the problem is fixed or has cleared naturally.

### Dismiss when the signal is expected noise

Dismissals are useful for false positives, maintenance windows, and clearly non-actionable events.

## Best practices

- Prefer resolving or dismissing with intent instead of letting incidents linger.
- Review recurring incidents for better thresholds or stronger telemetry.
- Use incident detail as the entry point into logs, traces, and metrics.

## Related pages

- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
- [Investigate a production incident](/docs/guides/investigate-a-production-incident)
