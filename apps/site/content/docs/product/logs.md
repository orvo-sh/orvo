---
title: Logs
description: Search, filter, and inspect application logs in Orvo.
order: 2
previous: product/overview
next: product/traces
---

# Logs

Logs are often the fastest way to answer "what just happened?" Orvo's logs view is built for narrowing quickly, then opening one event in detail.

![Logs overview](/docs/screenshots/product/logs-screenshot-full.png)

## What is it?

The logs view combines:

- Search and filter controls
- A time range picker
- A volume histogram
- A stream of matching log events
- A detail panel for the selected event

This is the place to start when you already know the symptom: checkout failures, webhook errors, a job timing out, or a new warning spike after a release.

## When to use it

Use logs when you need:

- The exact error message
- Structured attributes for one event
- A quick filter by service or environment
- A trace ID to continue the investigation

## Search

You can start broad, then narrow.

Examples that work well in practice:

- Search a message body such as `checkout failed`
- Filter by environment, service, or severity
- Search for a provider-specific field such as `payment.provider`

![Logs search](/docs/screenshots/product/logs-search.png)
_Search is most useful when paired with one service and one environment instead of the entire workspace._

## Filters

For a real investigation, the first three filters are usually enough:

- Environment
- Service
- Severity

A useful starting point for Cartlane looks like:

- `environment = production`
- `service = checkout-api`
- `level = error`

![Logs filters](/docs/screenshots/product/logs-filters.png)
_Applied filters keep the stream tight enough to read without losing context._

## Histogram

The histogram answers a different question from the log rows: `when did the spike happen?`

That helps you align logs with:

- a release window
- an incident start time
- a trace slowdown
- a burst of provider failures

![Logs histogram](/docs/screenshots/product/logs-histogram.png)
_Use the volume spike to choose the right time window before you read individual events._

## Inspecting log detail

Once you open a row, the detail panel becomes the source of truth for that event.

Look for:

- The exact message body
- Severity and receive time
- Service and environment metadata
- Business identifiers like `order.id` and `cart.id`
- Technical identifiers like `request.id`, `trace_id`, and `span_id`

![Logs detail](/docs/screenshots/product/logs-detail.png)
_The detail view is where the raw event becomes actionable context._

## Attributes and linked traces

The highest-value logs are the ones that carry enough context to continue the investigation somewhere else.

In practice, that usually means a log should contain:

- a service name
- a route or operation name
- an environment
- a trace ID
- one or two business identifiers

![Logs linked trace](/docs/screenshots/product/logs-linked-trace.png)
_A good log makes the jump to trace context obvious instead of forcing you to guess._

## Common workflows

### Find the failing request

Filter to one service and severity, then search for the message pattern you already suspect.

### Compare before and after a spike

Use the histogram first, then inspect a few representative rows from each side of the spike.

### Pivot from logs to traces

Open the failing log and follow its trace context into [Traces](/docs/product/traces).

## Best practices

- Use structured attributes, not only free-form messages.
- Keep service names stable.
- Always set `deployment.environment`.
- Include request and business IDs when they matter.
- Do not log secrets, tokens, or raw card data.

## Related pages

- [Traces](/docs/product/traces)
- [Metrics](/docs/product/metrics)
- [Find the root cause of an error](/docs/guides/find-the-root-cause-of-an-error)
