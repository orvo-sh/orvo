---
title: Retention
description: Understand how long Orvo keeps telemetry data.
order: 5
previous: concepts/attributes
next: concepts/incidents
---

# Retention

Retention is how long Orvo keeps telemetry available for querying and investigation.

## Why it matters

Retention changes what questions you can answer.

Short retention is fine for live debugging. Longer retention helps with:

- Comparing before and after a release
- Understanding recurring incidents
- Reviewing historical performance regressions

## How Orvo uses it

In the current product plans, retention is set per organization plan level.

Today the implemented defaults are:

- Pro: 30 days for logs, traces, and metrics

Heartbeats and incidents are operational data and should still be treated as live workflow features first.

## Example

If your team wants to compare this week's checkout errors to a release from three weeks ago, Pro's 30-day retention keeps both periods available.

## Related pages

- [Limits](/docs/reference/limits)
- [Production best practices](/docs/guides/production-best-practices)
- [Changelog](/docs/reference/changelog)
