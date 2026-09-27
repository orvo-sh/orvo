---
title: Slack
description: Investigate telemetry with Scout and receive incident notifications in Slack.
order: 1
previous: guides/production-best-practices
next: integrations/email
---

# Slack

Install Scout in a Slack workspace to investigate telemetry and receive notifications when alerts open, repeat, or resolve and when heartbeat monitors miss a check-in or recover.

## Connect Slack

1. Open your app in Orvo.
2. Go to **Settings → Integrations → Scout for Slack**.
3. Select **Connect Slack**.
4. In Slack, choose the workspace where Scout should be installed.
5. Invite Orvo to the channel where notifications should be sent.
6. Return to Orvo, refresh the channel list, and select that notification channel.

The installation belongs to the workspace. The channel selected in Orvo is only the default notification destination; Scout can also be used in direct messages and in other channels where Orvo has been invited.

## Configure Scout events

In your Slack app settings, open **Event Subscriptions**, enable events, and set the request URL to:

```text
https://YOUR_ORVO_ORIGIN/api/integrations/slack/events
```

Under **Subscribe to bot events**, add `app_mention`, `message.channels`, `message.groups`, and `message.im`. Orvo handles Slack's URL verification challenge at this endpoint.

The OAuth installation requests `app_mentions:read`, `chat:write`, `channels:history`, `channels:read`, `groups:history`, `groups:read`, and `im:history`. Enable the Messages tab and Agent experience in the Slack app settings for direct messages and native agent sessions.

If Slack was connected before Scout for Slack was enabled, reconnect it from **Settings → Integrations → Scout for Slack** to grant the additional bot permissions.

## Ask Scout

Message Orvo directly, or invite it to a channel and mention `@Orvo` to start a conversation. The first time each Slack user asks a question, Orvo sends that user a private account-link button. After they sign in to Orvo and confirm the link, the original question resumes automatically.

Each Slack thread is stored as a regular Scout conversation. Replies in an established Scout thread continue the conversation without another mention. Scout keeps Slack responses compact and streams them into the thread.

Scout can request changes such as resolving incidents or updating alert rules. Approve or cancel the requested action in Slack. Orvo checks the approving Slack user's linked Orvo account and current organization membership before continuing.

## Add Slack to an alert or heartbeat

Connecting Slack does not add it to existing rules automatically.

- For an alert, open **Alerts**, create or edit a rule, and select the Slack destination.
- For a heartbeat, open **Heartbeats**, create or edit a monitor, and select the Slack destination.

Only enabled destinations receive notifications.

## Test the connection

Open **Settings → Integrations → Scout for Slack** and select **Test notification**. Orvo posts a test message to the notification channel selected in Orvo.

## Work with incidents from Slack

Slack notifications include the app name and details about the alert rule or heartbeat monitor. Use **Ask Scout** to start an investigation in the notification thread, **View in Orvo** to open the incident, or **Resolve** to resolve it in Orvo.

## Change the notification channel or disconnect

Invite Orvo to another channel, refresh the channel list in the integration settings, and select it to change the notification destination. Disconnect Slack from the same page to remove the workspace installation from the current Orvo app.

## Related pages

- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
- [Incidents](/docs/product/incidents)
- [Webhooks](/docs/integrations/webhooks)
