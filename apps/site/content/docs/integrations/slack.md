---
title: Slack
description: Send alert and heartbeat notifications to a Slack channel.
order: 1
previous: guides/production-best-practices
next: integrations/email
---
# Slack

Connect a Slack channel to receive notifications when alerts open, repeat, or resolve and when heartbeat monitors miss a check-in or recover.

## Connect Slack

1. Open your app in Orvo.
2. Go to **Settings → Notification destinations**.
3. Select **Add notification destination**.
4. Choose **Slack**, then select **Connect to Slack**.
5. In Slack, choose the workspace and channel where Orvo should post.

Orvo adds the selected channel as a notification destination for the current app. An app can have one connected Slack channel; connecting another channel replaces the existing Slack destination.

## Add Slack to an alert or heartbeat

Connecting Slack does not add it to existing rules automatically.

- For an alert, open **Alerts**, create or edit a rule, and select the Slack destination.
- For a heartbeat, open **Heartbeats**, create or edit a monitor, and select the Slack destination.

Only enabled destinations receive notifications.

## Test the connection

Open **Settings → Notification destinations**, open the Slack destination's action menu, and select **Test destination**. Orvo posts a test message to the connected channel.

## Work with incidents from Slack

Slack notifications include the app name and details about the alert rule or heartbeat monitor. Use **View in Orvo** to open the incident. While an incident is open, you can also select **Resolve** in Slack to resolve it in Orvo.

## Change or disconnect the channel

Delete the Slack destination to disconnect it. This removes it from alert rules and heartbeat monitors and deletes its recorded deliveries. Connect Slack again to choose another workspace or channel.

## Related pages

- [Alerts](/docs/product/alerts)
- [Heartbeats](/docs/product/heartbeats)
- [Incidents](/docs/product/incidents)
- [Webhooks](/docs/integrations/webhooks)
