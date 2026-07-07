---
title: Insights
description: Use Orvo insights to spot changes and risks faster.
order: 10
previous: product/deployments
next: guides/investigate-a-production-incident
---
# Insights

Insights are the product behavior that helps surface `what changed` before you already know where to look.

## Current product shape

Today, Orvo's strongest insight workflow is distributed across:

- overview pages
- alert and incident creation
- metric spikes
- trace slowdowns
- log volume changes

A dedicated insights surface can evolve over time, but the product already supports the core thinking behind it.

## What insight should mean in Orvo

For a small team, useful insight is usually one of these:

- error rate spiked in one service
- latency regressed after a release
- a scheduled job stopped checking in
- a container stopped reporting
- one route became much noisier than the rest

## How to use the current product this way

Start from whichever signal changed first, then move quickly:

1. Open the spike in [Metrics](/docs/product/metrics)
2. Confirm whether [Incidents](/docs/product/incidents) or [Alerts](/docs/product/alerts) already opened
3. Inspect [Logs](/docs/product/logs) and [Traces](/docs/product/traces) for the affected service

## Best practices

- Keep telemetry clean enough that real changes stand out.
- Use alerts for the handful of signal changes you truly care about.
- Track deployment metadata so unusual shifts are easier to explain.

## Related pages

- [Product overview](/docs/product/overview)
- [Investigate a production incident](/docs/guides/investigate-a-production-incident)
- [Production best practices](/docs/guides/production-best-practices)
