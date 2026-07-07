---
title: Find the root cause of an error
description: Trace an error back to the service, request, or deployment that caused it.
order: 3
previous: guides/debug-a-slow-request
next: guides/monitor-a-cron-job
---
# Find the root cause of an error

Scenario: users are seeing payment failures.

## When to use this guide

Use it when you know the error symptom, but not whether the cause is your code, a dependency, bad input, or a recent release.

## Before you start

You should have logs with structured attributes and traces with propagated context.

## Step 1: locate the exact error log

In [Logs](/docs/product/logs), filter to the affected service and environment.

Search for the concrete message or error code, such as `Payment authorization declined` or `error.code=card_declined`.

## Step 2: inspect the attributes

Pull out the fields that define the failing request:

- `trace_id`
- `request.id`
- `http.route`
- `payment.provider`
- `deployment.version`

## Step 3: follow the trace

Open the related trace and identify:

- the first failing span
- the service that owns it
- whether the error was local or downstream

## Step 4: compare against healthy traffic

Use [Metrics](/docs/product/metrics) or adjacent logs to see whether this is a one-off edge case or the start of a broader regression.

## Step 5: connect it to change context

If the same error only appears on one deployment version or right after a rollout, treat that as a strong lead.

## What to check next

Once you have the likely cause, decide whether to:

- roll back
- patch the service
- suppress noisy input
- tighten alerts around the critical signal

## Related pages

- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
- [Investigate a production incident](/docs/guides/investigate-a-production-incident)
