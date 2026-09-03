---
title: Hosts
description: Monitor Linux servers with Orvo Agent.
order: 7
previous: product/heartbeats
next: product/incidents
---
# Hosts

Hosts gives you a live inventory of Linux servers monitored by Orvo Agent. Use it to find infrastructure pressure or a server that has stopped reporting.

## Add a host

1. Open **Hosts** and select **Add host**.
2. Enter a display name and environment.
3. Select **Generate command**.
4. Copy the one-time enrollment command and run it on the Linux server.

The enrollment command expires at the time shown in the dialog and can be used once. The Hosts page refreshes automatically while it waits for the first metrics.

## What Orvo collects

The host list shows:

- reporting status
- CPU utilization
- memory utilization
- filesystem utilization
- one-minute load average
- the time the host last reported

Open a host to view these signals over the last hour, 4 hours, 24 hours, or 7 days. The detail page also shows its system hostname, host ID, operating system, architecture, agent version, and reported environment.

## Reporting status

- **Connecting** means the host is enrolled but has not sent metrics yet.
- **Active** means the agent is reporting normally.
- **Not reporting** means Orvo has received data from the host before, but the agent is no longer reporting.

## Edit or delete a host

You can change the display name and environment stored in Orvo from the host detail page. Changing the environment there does not change the installed agent's configuration.

Deleting a host revokes its ingestion key and removes it from Hosts. Existing telemetry remains until the end of its normal retention period. To reconnect a deleted host, enroll the agent again.

## Related pages

- [Metrics](/docs/product/metrics)
- [Alerts](/docs/product/alerts)
- [Production best practices](/docs/guides/production-best-practices)
