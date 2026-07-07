---
title: Webhooks
description: Send Orvo events to your own systems.
order: 3
previous: integrations/email
next: integrations/github
---
# Webhooks

Webhooks are the most flexible notification integration in the current product.

## What they are for

Use webhooks when you want Orvo to notify:

- an internal incident bot
- a relay that forwards into Slack or PagerDuty-style systems
- an automation workflow
- a custom responder service

## How it works in Orvo

Webhook destinations currently support:

- a name
- a destination URL
- optional custom headers
- enabled or disabled state

You can attach the destination to alert rules or heartbeat monitors.

## Delivery behavior

The notification system records delivery attempts and test sends, so webhook destinations are part of the same incident and notification flow as email destinations.

## Security notes

Orvo lets you configure custom headers for outbound webhook requests. Use that to pass authentication or routing metadata to your receiving service.

Do not put secrets into URL query strings when a header will do.

## Related pages

- [Slack](/docs/integrations/slack)
- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
