---
title: Logs
description: Search production logs with structured filters, live volume, and trace-linked detail.
order: 2
previous: product/overview
next: product/traces
---

# Logs

Orvo brings message search, structured filters, volume trends, and event detail into one log explorer. Move from a production spike to the records behind it, with service and trace context close at hand.

![Logs overview](/docs/screenshots/product/logs-screenshot-full.png)

## Search the fields behind the message

Search log bodies and structured attributes, then combine filters across the fields that matter to your service. Match exact values, search within text, compare numeric values, or use value suggestions to target data already in your stream. Sort by timestamp, severity, or service.

![Logs search](/docs/screenshots/product/logs-search.png)

![Logs filters](/docs/screenshots/product/logs-filters.png)

## See the change in context

The volume histogram breaks activity down by severity across the selected time range. Click a bucket to focus on that interval, then compare the events around a spike. Use preset or custom ranges, live mode, and manual refresh to follow active incidents as new logs arrive.

![Logs histogram](/docs/screenshots/product/logs-histogram.png)

## Inspect the complete event

Keep the message, severity, environment, scope, and timestamps together with the event's log, resource, and scope attributes. Structured values stay readable in the detail panel, so useful context does not disappear inside a flattened line.

![Logs detail](/docs/screenshots/product/logs-detail.png)

## Follow the request

When a log includes trace context, open its trace to see the spans behind the event and how the request moved across services. Move from a precise log record into [Traces](/docs/product/traces) without searching for the same request again.

![Logs linked trace](/docs/screenshots/product/logs-linked-trace.png)

## Explore the rest of the signal

- [Traces](/docs/product/traces)
- [Metrics](/docs/product/metrics)
- [Find the root cause of an error](/docs/guides/find-the-root-cause-of-an-error)
