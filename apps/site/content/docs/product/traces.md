---
title: Traces
description: Investigate requests and background jobs across services.
order: 3
previous: product/logs
next: product/metrics
---
# Traces

Traces show how one request or job moved through your system, which spans took time, and where the failure started.

## What is it?

In Orvo, a trace is a grouped execution timeline built from spans. The product lets you search and sort traces by time, duration, span count, status, service, and custom conditions.

## When to use it

Use traces when you need to answer:

- Which service failed first?
- Where did the time go?
- Was the problem upstream, downstream, or internal?
- Did the request fan out into multiple systems?

## How it works in Orvo

The traces surface supports:

- Time range filtering
- Service and environment filtering
- Status filtering for `ok` vs `error`
- Duration bounds for slow trace hunting
- Drill-down into a single trace and span waterfall

A good trace investigation usually starts with one of two patterns:

- A log gave you a trace ID
- A latency or error spike tells you to search for slow or failing traces first

## Common workflows

### Find a slow request

Search traces for one service, then sort by duration descending. Open one of the slowest traces and inspect the span waterfall.

### Debug a failed request

Filter to `error` traces for one environment, then inspect the root span and the first downstream failure.

### Move from trace to logs

Once you know the failing span or service, jump back to [Logs](/docs/product/logs) for the exact messages around that time.

## Best practices

- Keep span names stable and readable.
- Make sure entry spans represent real user or job operations.
- Propagate trace context across service boundaries.
- Add useful span attributes instead of burying everything in messages.

## Related pages

- [Logs](/docs/product/logs)
- [Metrics](/docs/product/metrics)
- [Debug a slow request](/docs/guides/debug-a-slow-request)
