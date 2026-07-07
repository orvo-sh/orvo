---
title: Monitor a cron job
description: Use heartbeats to monitor scheduled and recurring jobs.
order: 4
previous: guides/find-the-root-cause-of-an-error
next: guides/track-a-deployment
---
# Monitor a cron job

Scenario: a nightly billing sync must check in on time.

## When to use this guide

Use it for any scheduled job where `did it run?` matters more than deep tracing.

## Before you start

You need a heartbeat monitor and a place in the job where it can call the secret heartbeat URL.

## Step 1: create a heartbeat monitor

Define:

- a readable name such as `nightly billing sync`
- the expected interval
- a realistic grace period
- one or more destinations for notifications

## Step 2: wire the heartbeat URL into the job

Call the monitor's secret URL once the job reaches a successful checkpoint.

## Step 3: test a real check-in

Trigger the job or send a manual request to the heartbeat URL, then confirm that the monitor shows a recent check-in.

## Step 4: verify missed behavior

If the job does not check in before the expected interval plus grace period, Orvo should move the monitor to `missed` and can open an incident.

## What to check next

Once the monitor works, review whether:

- the interval is correct
- the grace period is too tight
- the destinations route to the right people or automation

## Related pages

- [Heartbeats](/docs/product/heartbeats)
- [Incidents](/docs/product/incidents)
- [Email](/docs/integrations/email)
