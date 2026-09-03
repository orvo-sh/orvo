---
title: Email
description: Send Orvo notifications by email.
order: 2
previous: integrations/slack
next: integrations/webhooks
---
# Email

Use an email destination to send alert and heartbeat notifications directly to a person, an on-call rotation, or a shared inbox.

## When to use it

Email works well for:

- a small on-call rotation
- low-volume operational notifications
- a fallback delivery path
- a shared engineering inbox

## Create an email destination

1. Open your app in Orvo.
2. Go to **Settings → Notification destinations**.
3. Select **Add notification destination**, then choose **Email**.
4. Enter a name and add up to 5 email addresses. Press Enter or Space after each address.
5. Select **Add destination**.

Attach the destination when you create or edit an alert rule or heartbeat monitor. Use **Test destination** from its action menu to send a test email.

You can edit the name, recipients, and enabled state later. Disabled destinations remain attached to their rules and monitors but do not receive notifications.

## Best practices

- Keep recipients intentional instead of broad.
- Use email for actions people will actually read.
- Pair email with incidents so the message has clear context.

## Related pages

- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
- [Incidents](/docs/product/incidents)
