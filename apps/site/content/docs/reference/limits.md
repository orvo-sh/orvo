---
title: Limits
description: Understand Orvo limits for ingestion, storage, and usage.
order: 3
previous: reference/environment-variables
next: reference/error-codes
---
# Limits

This page documents product limits that are visible in the current codebase, plus a few practical query caps that affect day-to-day use.

## Retention

Current plan defaults:

- Starter: 14 days for logs, metrics, and traces
- Pro: 30 days for logs, metrics, and traces

## Included ingestion volume

Current plan defaults:

- Starter: 50 GB included ingestion
- Pro: 150 GB included ingestion

## Upload size

The current max upload file size constant is 10 MB.

## Query caps in the app

A few implemented request limits are worth knowing:

- Logs and traces list requests cap at 500 rows per request
- Metrics bucket count caps at 240
- Log and trace filter arrays cap at 50 conditions

## Notification destination caps

Current destination validation includes:

- up to 20 custom webhook headers
- up to 50 email recipients

## Notes

Not every operational limit is exposed as a polished product contract yet. If you need a specific hard guarantee around request size, throughput, or plan behavior, validate it against the current deploy rather than assuming more than the code or plan currently shows.

## Related pages

- [Retention](/docs/concepts/retention)
- [Environment variables](/docs/reference/environment-variables)
- [Error codes](/docs/reference/error-codes)
