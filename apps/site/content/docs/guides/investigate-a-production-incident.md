---
title: Investigate a production incident
description: Use Orvo to investigate and resolve a production issue.
order: 1
previous: product/insights
next: guides/debug-a-slow-request
---
# Investigate a production incident

This guide walks through a realistic workflow for the scenario: checkout errors increased in production.

## When to use this guide

Use it when an alert or heartbeat miss already opened an [Incident](/docs/product/incidents), or when the team knows something is wrong but needs a clean path to root cause.

## Before you start

You should have:

- one affected app or service in mind
- at least logs and traces flowing to Orvo
- an environment value such as `production`

## Step 1: open the incident

Start from the incident detail page if one exists.

Look at:

- severity
- source type
- start time
- affected entity or app
- linked source rule or heartbeat monitor

## Step 2: inspect logs in the incident window

Jump to [Logs](/docs/product/logs) for the incident time range.

Filter to:

- `production`
- the impacted service, such as `checkout-api`
- error or warning logs

Find one representative failure instead of reading everything.

## Step 3: pivot to the related trace

Open the failure log and follow the `trace_id` into [Traces](/docs/product/traces).

In the trace, answer:

- where the first error happened
- whether latency spiked before the failure
- which downstream call or dependency failed

## Step 4: check whether the blast radius is growing

Open [Metrics](/docs/product/metrics) and compare the incident window against the preceding baseline.

Look for:

- error rate increase
- throughput drop
- p95 latency regression

## Step 5: decide what changed

Use whatever release context you have in the telemetry itself:

- `deployment.version`
- a new environment-specific attribute
- a service-specific regression in one version only

## Step 6: resolve or dismiss intentionally

When the signal is healthy again, resolve the incident.
If it was expected or non-actionable, dismiss it with a clear reason.

## What to check next

After the incident is handled, ask:

- Did the alert trigger too late or too early?
- Were the logs detailed enough?
- Would a better trace attribute have shortened the investigation?

## Related pages

- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
- [Reduce noisy alerts](/docs/guides/reduce-noisy-alerts)
