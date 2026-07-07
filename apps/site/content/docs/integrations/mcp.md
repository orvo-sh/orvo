---
title: MCP
description: Use Orvo through Model Context Protocol tools.
order: 5
previous: integrations/github
next: reference/api
---
# MCP

MCP lets AI assistants and tools inspect Orvo data through a scoped server interface instead of scraping the UI.

## What it is for

The MCP surface is useful when you want an assistant to help with tasks such as:

- list the apps this token can access
- query logs for a failing service
- search traces in a time window
- inspect incidents or heartbeat monitors
- summarize a service's current health

## How it works in Orvo

The current app exposes an MCP endpoint at:

```text
/api/mcp
```

Access can be granted through MCP tokens or OAuth-based flows, and tokens can be restricted to specific apps and scopes.

Read-oriented scopes currently include areas such as:

- `app:read`
- `logs:read`
- `traces:read`
- `metrics:read`
- `incidents:read`
- `heartbeats:read`
- `alerts:read`

## Practical examples

A useful assistant workflow might be:

- list the allowed apps
- query production logs for `checkout-api`
- fetch the slowest traces in the last hour
- summarize any open incidents

## Best practices

- Create separate tokens per use case.
- Grant the narrowest scopes that still solve the problem.
- Limit allowed app access instead of using one broad token everywhere.

## Related pages

- [API](/docs/reference/api)
- [Logs](/docs/product/logs)
- [Incidents](/docs/product/incidents)
