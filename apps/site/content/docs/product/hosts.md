---
title: Hosts
description: Monitor servers and infrastructure in Orvo.
order: 7
previous: product/heartbeats
next: product/incidents
---
# Hosts

Hosts matter when the application looks unhealthy but the real problem sits lower in the stack.

## What is it?

Orvo already stores host-related identity on metrics, including fields such as `host.id`, `host.name`, and `host.arch` when those arrive with telemetry.

## Current product shape

Today, Orvo does not expose a large dedicated host inventory page in the same way it exposes logs or traces.

Instead, host and infrastructure context shows up through:

- metric dimensions and grouping
- log and resource attributes
- container-focused alert signals
- the surrounding app investigation workflow

## When to use it

Host context helps when you need to answer:

- Is one machine or node unhealthy?
- Did CPU or memory saturation precede the app issue?
- Is a container simply no longer reporting?

## How it works in Orvo

For now, the practical workflow is:

1. Use [Metrics](/docs/product/metrics) to inspect infrastructure-related signals.
2. Filter or group by the host or container dimensions you send.
3. Use [Alerts](/docs/product/alerts) for container CPU, memory, or stale reporting conditions.

## Best practices

- Send host identity consistently in infrastructure telemetry.
- Keep service telemetry and infrastructure telemetry aligned on environment.
- Treat host investigation as supporting context, not a replacement for app logs and traces.

## Related pages

- [Metrics](/docs/product/metrics)
- [Alerts](/docs/product/alerts)
- [Production best practices](/docs/guides/production-best-practices)
