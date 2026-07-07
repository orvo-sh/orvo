---
title: Slack
description: Send Orvo notifications to Slack.
order: 1
previous: guides/production-best-practices
next: integrations/email
---
# Slack

Slack is a common destination for production notifications, but it is important to separate `Slack as a workflow` from `Slack as a native product feature`.

## Current product shape

Today, Orvo supports reusable notification destinations for:

- email
- webhooks

A dedicated first-party Slack destination is not exposed in the current app.

## Practical ways to use Slack today

The usual pattern is:

1. Create a [Webhook](/docs/integrations/webhooks) destination in Orvo.
2. Point it at your own relay, incident bot, or Slack-compatible workflow.
3. Attach that destination to alert rules or heartbeat monitors.

## When Slack is a good fit

Slack is useful for:

- team-wide visibility
- low-friction acknowledgements
- links into incidents or runbooks

It is less useful when every small warning lands in a noisy shared channel.

## Best practices

- Separate high-urgency alerts from informational notifications.
- Use routing that matches service ownership.
- Keep critical channels for action, not constant background noise.

## Related pages

- [Webhooks](/docs/integrations/webhooks)
- [Alerts](/docs/product/alerts)
- [Reduce noisy alerts](/docs/guides/reduce-noisy-alerts)
