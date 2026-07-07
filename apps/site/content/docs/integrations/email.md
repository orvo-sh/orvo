---
title: Email
description: Send Orvo notifications by email.
order: 2
previous: integrations/slack
next: integrations/webhooks
---
# Email

Email destinations are useful when humans need a clear record of an alert, incident, or missed heartbeat without requiring a custom webhook workflow.

## What email is for

In the current product, email destinations can be attached to alert rules and heartbeat monitors through reusable notification destinations.

## When to use it

Email works well for:

- a small on-call rotation
- low-volume operational notifications
- a fallback delivery path
- a shared engineering inbox

## How it works in Orvo

A notification destination can be created with:

- a readable name
- up to 50 recipients
- enabled or disabled state

You can then attach it to the alert rules or heartbeat monitors that need it.

## Best practices

- Keep recipients intentional instead of broad.
- Use email for actions people will actually read.
- Pair email with incidents so the message has clear context.

## Related pages

- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
- [Incidents](/docs/product/incidents)
