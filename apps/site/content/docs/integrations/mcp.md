---
title: MCP
description: Connect an AI agent to your Orvo observability data with read-only access.
order: 5
previous: integrations/github
next: reference/api
---

# MCP

Orvo's Model Context Protocol server lets compatible AI agents investigate your telemetry directly. It uses OAuth and grants read-only access to one organization at a time.

## Connect

Add this remote MCP server URL to your MCP client:

```text
https://app.orvo.sh/api/mcp
```

Your client opens Orvo in the browser. Sign in, select the organization you want the agent to use, and choose **Allow access**. You do not need to create or copy an API key.

The selected organization includes all of its apps. When an organization has several apps, the agent can discover them with `list_apps` and pass the relevant `appId` to the other tools.

## Available tools

The MCP server can:

- list apps and summarize an app's current observability state
- search logs and fetch a complete log record
- search traces, fetch a trace, and inspect the service graph
- query metric series
- list and inspect incidents
- list and inspect heartbeat monitors
- list and inspect alert rules

All tools are read-only. The server limits result sizes and returns compact structured data so an agent can investigate without filling its context window with raw telemetry.

## A useful investigation flow

Ask your agent to start with `get_app_overview`, then narrow the investigation with the signal-specific tools. For example:

1. Find recent error traces with `search_traces`.
2. Inspect one trace with `get_trace`.
3. Correlate its trace ID with `search_logs`.
4. Check `list_incidents` and `list_alert_rules` for related operational context.

## Change the organization

Reconnect or re-authorize the MCP server and select a different organization. A new authorization replaces the organization previously granted to that client.

## Security

Access tokens are scoped to `mcp:read`, tied to the selected organization, and rechecked against your current organization membership on every MCP request. Removing a user from an organization immediately prevents further MCP access to it.

## Related pages

- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
- [Metrics](/docs/product/metrics)
- [Alerts](/docs/product/alerts)
- [Incidents](/docs/product/incidents)
