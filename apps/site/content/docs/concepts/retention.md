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

Orvo Cloud sets retention by organization plan:

- Pro: 30 days for logs, traces, and metrics

## Example

If your team wants to compare this week's checkout errors to a release from three weeks ago, Pro's 30-day retention keeps both periods available.

## Related pages

- [Limits](/docs/reference/limits)
- [Production best practices](/docs/guides/production-best-practices)
- [Product overview](/docs/product/overview)
