---
title: Track a deployment
description: Use deployments to understand what changed in production.
order: 5
previous: guides/monitor-a-cron-job
next: guides/create-useful-alerts
---
# Track a deployment

Scenario: a new Cartlane release went out and errors increased.

## When to use this guide

Use it whenever a production shift might be tied to a rollout.

## Before you start

Your logs or traces should include release metadata such as `deployment.version`.

## Step 1: define the release window

Pick the time range immediately before and after the deployment.

## Step 2: inspect metrics first

Open [Metrics](/docs/product/metrics) and compare error rate, latency, and throughput across that window.

## Step 3: inspect logs for the new version

In [Logs](/docs/product/logs), filter to the affected service and search for the deployment version or the error pattern you suspect.

## Step 4: open failing traces

If the problem is on the new release only, open the representative traces and confirm where the regression lives.

## What to check next

After the investigation, decide whether the team needs:

- a rollback
- a smaller rollout slice
- better release attributes in telemetry
- stronger alerting around the changed service

## Related pages

- [Deployments](/docs/product/deployments)
- [Metrics](/docs/product/metrics)
- [Find the root cause of an error](/docs/guides/find-the-root-cause-of-an-error)
