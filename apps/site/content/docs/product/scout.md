---
title: Scout
description: Investigate production issues across your telemetry with Orvo's AI assistant.
order: 11
previous: product/insights
next: guides/investigate-a-production-incident
---

# Scout

Scout is Orvo's investigation assistant. Ask a question in plain language and Scout searches the telemetry in your organization for the signals that explain what changed.

## What Scout investigates

Scout can work across:

- logs and their structured attributes
- traces and failed spans
- metric changes
- open incidents and alert activity
- heartbeat monitor state
- recent deployments

It returns a concise explanation together with the evidence used to reach it, so you can verify the result and continue investigating in the underlying Orvo view.

## Start an investigation

Open Scout from your Orvo workspace and describe the symptom, scope, and time window. For example:

```text
Investigate the checkout errors that started after the latest deployment.
```

Add a service, environment, or time range when you already know where to focus. Scout can begin broadly when you do not.

## Ask useful questions

Good investigation prompts include:

- What changed after the latest deployment?
- Why did checkout errors increase in production?
- Which service is contributing most to p95 latency?
- Are these alerts part of the same incident?
- Which recurring jobs have missed a check-in today?

## Scout and MCP

Scout is built into Orvo. The [MCP integration](/docs/integrations/mcp) gives compatible external agents read-only access to the same organization context and observability tools.

## Related pages

- [Investigate a production incident](/docs/guides/investigate-a-production-incident)
- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
- [Incidents](/docs/product/incidents)
