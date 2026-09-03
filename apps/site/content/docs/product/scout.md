---
title: Scout
description: Investigate telemetry and manage operational workflows with Orvo's AI assistant.
order: 10
previous: product/deployments
next: guides/investigate-a-production-incident
---

# Scout

Scout is Orvo's built-in investigation assistant. Ask a question in plain language and it searches the current app's telemetry and operational data for an answer you can verify.

## What Scout can investigate

Scout can:

- summarize the current app's telemetry and operational state
- search logs and inspect individual log records
- search traces, inspect spans, and read the service graph
- query metric series
- inspect incidents and their event history
- inspect heartbeat monitors and alert rules

Scout can also create, update, enable, disable, and delete alert rules; create and manage heartbeat monitors; resolve or dismiss incidents; and rename the current app. Scout asks for confirmation before consequential changes.

## Start an investigation

Open Scout from the sidebar or select **Ask Scout** from a supported product page. When you open it from a page, Scout receives a compact description of what you are viewing, such as the selected time range, filters, or record ID.

Describe the symptom, scope, and time window. For example:

```text
Why did checkout errors increase in production during the last hour?
```

Useful questions include:

- Which service is contributing most to p95 latency?
- Do the failed traces share an error or slow dependency?
- Are these alerts connected to the same incident?
- Which heartbeat monitors need attention?
- Create an alert for this signal at the threshold we discussed.

Review the evidence and any proposed change before acting on it. Scout is most useful when services, environments, trace context, and other attributes are recorded consistently.

## Scout and MCP

Scout works inside Orvo and can perform approved management actions. The [MCP integration](/docs/integrations/mcp) gives compatible external agents read-only access to organization telemetry and operational data.

## Related pages

- [Investigate a production incident](/docs/guides/investigate-a-production-incident)
- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
- [Incidents](/docs/product/incidents)
