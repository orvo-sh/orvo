---
title: Alerts
description: Create alerts for important production signals.
order: 5
previous: product/metrics
next: product/heartbeats
---
# Alerts

Alerts are the rules that tell Orvo when a signal deserves attention.

## What is it?

The current product supports threshold-based alert rules over application and container signals.

Implemented signal types include:

- Error rate
- P95 latency
- P99 latency
- Apdex
- Throughput per minute
- Availability percent
- Container CPU
- Container memory
- Container reporting stale

## When to use it

Use alerts for issues that need human attention soon, not for every interesting graph movement.

## How it works in Orvo

An alert rule defines:

- the signal type
- a comparator such as greater-than or less-than
- the threshold
- the evaluation window
- optional re-notification timing
- destinations for delivery

When a rule breaches, Orvo can open an incident and send notifications through configured webhook or email destinations.

## Common workflows

### Protect the critical path

Create a small set of rules around:

- checkout error rate
- checkout latency
- availability
- worker or container health

### Route the right alerts

Attach different destinations depending on the team or workflow. For example, email for broad visibility and webhooks for automation.

## Best practices

- Start with a few rules you will actually investigate.
- Use separate severity expectations for customer-impacting and background signals.
- Prefer good thresholds and windows over hyper-reactive paging.
- Review open incidents, not just raw alert firings.

## Related pages

- [Incidents](/docs/product/incidents)
- [Create useful alerts](/docs/guides/create-useful-alerts)
- [Reduce noisy alerts](/docs/guides/reduce-noisy-alerts)
