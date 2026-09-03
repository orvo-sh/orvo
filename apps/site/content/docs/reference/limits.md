---
title: Limits
description: Understand Orvo limits for ingestion, storage, and usage.
order: 3
previous: reference/environment-variables
next: reference/error-codes
---

# Limits

These limits apply to Orvo Cloud unless a section says otherwise.

## Retention

- Pro: 30 days for logs, metrics, and traces

## Included ingestion volume

- Pro: 150 GB included ingestion

## Upload size

Uploads can be up to 10 MB. Scout accepts up to 5 attachments per message.

## Query limits

- Logs and traces list requests return at most 500 rows per request.
- Metric queries return at most 240 time buckets.
- A log or trace query accepts at most 50 filter conditions.

## Notification destination caps

- A webhook destination accepts up to 20 custom headers.
- An email destination accepts up to 5 recipients.

## Related pages

- [Retention](/docs/concepts/retention)
- [Environment variables](/docs/reference/environment-variables)
- [Error codes](/docs/reference/error-codes)
