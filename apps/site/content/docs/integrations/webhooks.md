---
title: Webhooks
description: Send Orvo events to your own systems.
order: 3
previous: integrations/email
next: integrations/github
---
# Webhooks

Webhook destinations send Orvo notifications to an HTTP endpoint you control.

## What they are for

Use webhooks when you want Orvo to notify:

- an internal incident bot
- an incident-management or paging system
- an automation workflow
- a custom responder service

## How it works in Orvo

Webhook destinations support:

- a name
- a destination URL
- optional custom headers
- enabled or disabled state

You can attach the destination to alert rules or heartbeat monitors.

## Create a webhook destination

1. Open your app in Orvo.
2. Go to **Settings → Notification destinations**.
3. Select **Add notification destination**, then choose **Webhook**.
4. Enter a name and HTTPS endpoint. Add authentication or routing headers if the receiver requires them.
5. Select **Add destination**.

Use **Test destination** from the destination's action menu before attaching it to a production rule.

## Delivery behavior

Orvo sends a JSON `POST` request for alert-opened, alert-repeat, alert-resolved, heartbeat-missed, heartbeat-recovered, and test events. A delivery succeeds when the endpoint returns a `2xx` response. Failed notification deliveries are retried after 1, 5, and 15 minutes.

## Security notes

Orvo lets you configure up to 20 custom headers for outbound webhook requests. Use them for authentication or routing metadata.

Do not put secrets into URL query strings when a header will do.

Orvo encrypts custom header values at rest. Treat the receiving endpoint as a production credential and rotate any secret that may have been exposed.

## Related pages

- [Slack](/docs/integrations/slack)
- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
