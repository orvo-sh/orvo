---
title: Debug a slow request
description: Find why a request is slower than expected.
order: 2
previous: guides/investigate-a-production-incident
next: guides/find-the-root-cause-of-an-error
---
# Debug a slow request

Scenario: `POST /api/checkout` is slower than usual.

## When to use this guide

Use it when a route or background operation still works, but takes too long.

## Before you start

You need traces for the affected service and enough logs or metrics to compare healthy and unhealthy runs.

## Step 1: start with traces

Open [Traces](/docs/product/traces) and filter to the service and environment you care about.

Sort by duration descending and open one of the slowest traces.

## Step 2: inspect the waterfall

Look for:

- a slow database span
- a downstream API call taking most of the time
- retries or repeated child spans
- a long gap before an error surfaces

## Step 3: confirm with logs

Switch to [Logs](/docs/product/logs) for the same request or time window.

Search for attributes or messages that explain the slowdown, such as:

- provider timeout
- retry scheduled
- query exceeded latency threshold

## Step 4: check the trend in metrics

Open [Metrics](/docs/product/metrics) to see whether the slowdown is isolated or widespread.

Compare p95 or p99 latency before and after the time you noticed the issue.

## What to check next

Ask whether the slow span points to:

- code in your service
- a database query
- a dependency
- a deployment regression

## Related pages

- [Traces](/docs/product/traces)
- [Metrics](/docs/product/metrics)
- [Track a deployment](/docs/guides/track-a-deployment)
