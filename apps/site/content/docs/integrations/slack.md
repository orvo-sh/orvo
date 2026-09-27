---
title: Slack
description: Investigate telemetry with Scout and receive incident notifications in Slack.
order: 1
previous: guides/production-best-practices
next: integrations/email
---

# Slack

Connect a Slack channel to investigate telemetry with Scout and receive notifications when alerts open, repeat, or resolve and when heartbeat monitors miss a check-in or recover.

## Connect Slack

1. Open your app in Orvo.
2. Go to **Settings → Notification destinations**.
3. Select **Add notification destination**.
4. Choose **Slack**, then select **Connect to Slack**.
5. In Slack, choose the workspace and channel where Orvo should post.

Orvo adds the selected channel as a notification destination for the current app. An app can have one connected Slack channel; connecting another channel replaces the existing Slack destination.

## Configure Scout events

In your Slack app settings, open **Event Subscriptions**, enable events, and set the request URL to:

```text
https://YOUR_ORVO_ORIGIN/api/integrations/slack/events
```

Under **Subscribe to bot events**, add `app_mention`. Orvo handles Slack's URL verification challenge at this endpoint. The OAuth installation requests `incoming-webhook`, `app_mentions:read`, and `chat:write`.

If Slack was connected before Scout for Slack was enabled, reconnect it from **Settings → Integrations → Scout for Slack** to grant the additional bot permissions.

## Ask Scout

Mention `@Orvo` in the connected channel. The first time each Slack user asks a question, Orvo sends that user a private account-link button. After they sign in to Orvo and confirm the link, the original question resumes automatically.

Each Slack thread is stored as a regular Scout conversation. Continue mentioning `@Orvo` in that thread to investigate further. Scout keeps Slack responses compact and streams them into the thread.

Scout can request changes such as resolving incidents or updating alert rules. Approve or cancel the requested action in Slack. Orvo checks the approving Slack user's linked Orvo account and current organization membership before continuing.

## Add Slack to an alert or heartbeat

Connecting Slack does not add it to existing rules automatically.

- For an alert, open **Alerts**, create or edit a rule, and select the Slack destination.
- For a heartbeat, open **Heartbeats**, create or edit a monitor, and select the Slack destination.

Only enabled destinations receive notifications.

## Test the connection

Open **Settings → Notification destinations**, open the Slack destination's action menu, and select **Test destination**. Orvo posts a test message to the connected channel.

## Work with incidents from Slack

Slack notifications include the app name and details about the alert rule or heartbeat monitor. Use **Ask Scout** to start an investigation in the notification thread, **View in Orvo** to open the incident, or **Resolve** to resolve it in Orvo.

## Change or disconnect the channel

Delete the Slack destination to disconnect it. This removes it from alert rules and heartbeat monitors and deletes its recorded deliveries. Connect Slack again to choose another workspace or channel.

## Related pages

- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
- [Incidents](/docs/product/incidents)
- [Webhooks](/docs/integrations/webhooks)
