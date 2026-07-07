---
title: Heartbeats
description: Monitor cron jobs, scheduled tasks, and recurring processes.
order: 6
previous: product/alerts
next: product/hosts
---
# Heartbeats

Heartbeats are the simplest way to monitor work that should happen on a schedule.

## What is it?

A heartbeat monitor expects a check-in on a known cadence. If the check-in does not arrive on time, Orvo moves the monitor through healthy, grace, and missed states.

## When to use it

Use heartbeats for:

- nightly billing syncs
- recurring data imports
- queue pollers
- backup jobs
- any worker that must check in regularly

## How it works in Orvo

The ingest service exposes heartbeat check-ins at:

```text
/v1/heartbeats/{token}
```

Each monitor stores:

- expected interval
- grace period
- destinations
- paused or active state
- last check-in time

A missed heartbeat can open an incident and trigger notifications.

## Common workflows

### Create a monitor

Give the job a readable name, define how often it should run, and pick the destinations that should hear about failures.

### Copy the heartbeat URL

Each monitor gets a secret URL you can call from cron, a worker, or deployment automation.

### Investigate missed runs

Open the monitor or related [Incident](/docs/product/incidents) to see when the last check-in happened and what notifications were sent.

## Best practices

- Set the expected interval to the real schedule, not the ideal one.
- Add a grace period that reflects queueing or scheduler variance.
- Pause a monitor during planned maintenance instead of ignoring repeated misses.

## Related pages

- [Incidents](/docs/product/incidents)
- [Monitor a cron job](/docs/guides/monitor-a-cron-job)
- [Notifications](/docs/integrations/email)
