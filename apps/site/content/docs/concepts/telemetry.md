---
title: Telemetry
description: Understand logs, traces, metrics, heartbeats, and host data in Orvo.
order: 1
previous: getting-started/your-first-investigation
next: concepts/services
---
# Telemetry

Telemetry is the evidence your systems emit while they run. Orvo collects that evidence so you can understand what happened in production.

## Why it matters

When production breaks, you rarely need one abstract dashboard. You need enough signal to answer a few direct questions:

- What failed?
- Where did it fail?
- How widespread is it?
- What changed?

Different signal types answer different parts of that.

## How Orvo uses it

Orvo works with these core signal types:

- Logs for discrete events and structured context.
- Traces for request and job execution paths.
- Metrics for aggregate health and trends over time.
- Heartbeats for recurring check-ins from scheduled work.
- Host and container attributes carried with metrics and telemetry.

## Example

A checkout failure might show up as:

- A log line with `error.code=card_declined`.
- A trace with a slow payment span.
- Metrics showing the error rate rose after a release.
- An incident opened from an alert rule.

Together, those are more useful than any one signal alone.

## Related pages

- [Services](/docs/concepts/services)
- [Attributes](/docs/concepts/attributes)
- [OpenTelemetry overview](/docs/opentelemetry/overview)
- [Product overview](/docs/product/overview)
