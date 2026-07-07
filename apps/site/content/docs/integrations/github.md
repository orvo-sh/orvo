---
title: GitHub
description: Connect Orvo activity with GitHub workflows.
order: 4
previous: integrations/webhooks
next: integrations/mcp
---
# GitHub

GitHub matters to Orvo in two different ways: account access and deployment context.

## Current product shape

The current app can be configured with GitHub OAuth credentials for authentication.

What is not exposed as a large first-party feature today is a dedicated GitHub deployment sync or release dashboard inside Orvo.

## Practical workflow today

If you want stronger GitHub-to-Orvo correlation right now:

- add release or commit metadata to your telemetry
- include deployment version attributes in logs and traces
- use [Webhooks](/docs/integrations/webhooks) for custom automation around deploy events

## When to use GitHub context

GitHub context is useful when a problem appears right after:

- a merge
- a deployment
- an infrastructure config change

## Related pages

- [Deployments](/docs/product/deployments)
- [Track a deployment](/docs/guides/track-a-deployment)
- [Environment variables](/docs/reference/environment-variables)
