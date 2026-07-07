---
title: Attributes
description: Use attributes to add searchable context to your telemetry.
order: 4
previous: concepts/environments
next: concepts/retention
---
# Attributes

Attributes are key-value fields attached to logs, spans, and metrics.

## Why it matters

Attributes turn raw telemetry into something you can filter, correlate, and explain.

Without them, your query becomes `show me errors`.
With them, your query becomes `show me checkout errors from Stripe in production after deployment 2026.07.07-1`.

## How Orvo uses it

Attributes power:

- Log filters and suggestions
- Trace conditions and service scoping
- Metric grouping by service or environment
- Correlation between logs and traces

## Example

Useful attributes for a checkout flow might include:

- `user.id`
- `cart.id`
- `order.id`
- `payment.provider`
- `payment.status`
- `request.id`
- `http.route`
- `deployment.version`

:::info
Prefer a few consistent attributes everywhere over many one-off fields that only appear in one code path.
:::

## Related pages

- [Telemetry](/docs/concepts/telemetry)
- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
- [Production best practices](/docs/guides/production-best-practices)
