---
title: Incidents
description: Understand how Orvo turns signals into incidents.
order: 6
previous: concepts/retention
next: opentelemetry/overview
---
# Incidents

An incident is Orvo's grouped record of an active or resolved problem.

## Why it matters

Alerts and heartbeat failures can create a lot of noise when treated as disconnected events.

Incidents give you one object to track:

- What opened
- What severity it had
- Whether it is still active
- What notifications were sent
- When it resolved or was dismissed

## How Orvo uses it

In the current product, incidents are opened from:

- Alert threshold breaches
- Missed heartbeat monitors

An incident can be:

- `open`
- `resolved`
- `dismissed`

## Example

If `checkout-api` error rate crosses its threshold, Orvo opens an incident tied to that rule. If the error rate returns to normal, the incident resolves. If the signal is expected noise, you can dismiss it with a reason.

## Related pages

- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
- [Investigate a production incident](/docs/guides/investigate-a-production-incident)
