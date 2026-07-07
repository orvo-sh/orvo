---
title: Create useful alerts
description: Create alerts that catch real issues without too much noise.
order: 6
previous: guides/track-a-deployment
next: guides/reduce-noisy-alerts
---
# Create useful alerts

Useful alerts point at real user or system risk. They do not merely confirm that your graph moved.

## When to use this guide

Use it when you already have telemetry in Orvo and want to decide which conditions deserve notification.

## Before you start

Pick one critical path first, such as checkout, sign-in, or payment processing.

## Step 1: alert on user-facing failure

Strong first rules are usually:

- error rate above threshold
- p95 or p99 latency above threshold
- availability percentage dropping

## Step 2: add one infrastructure or job rule

Examples:

- container CPU too high for too long
- container reporting stale
- a heartbeat monitor missed its check-in

## Step 3: choose the right window

Short windows are reactive but noisy.
Longer windows are calmer but slower.

Pick the shortest window that still reflects real impact.

## What to check next

After enabling the rule, ask:

- would I investigate this every time?
- does the destination match the severity?
- should this open an incident I care about?

## Related pages

- [Alerts](/docs/product/alerts)
- [Reduce noisy alerts](/docs/guides/reduce-noisy-alerts)
- [Incidents](/docs/product/incidents)
