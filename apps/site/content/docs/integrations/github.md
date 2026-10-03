---
title: GitHub
description: Sign in to Orvo with a GitHub account and add GitHub release context to telemetry.
order: 4
previous: integrations/webhooks
next: integrations/mcp
---

# GitHub

Orvo Cloud supports GitHub as a sign-in provider. This connects your GitHub identity for authentication; it does not import repositories, commits, pull requests, or deployments.

## Sign in with GitHub

Select **Continue with GitHub** on the Orvo sign-in page and authorize the requested account access. Your organization membership and app access are still managed in Orvo.


## Correlate releases with telemetry

To investigate a release, add its version, commit SHA, or other release identifier to the telemetry emitted by your services. Use the standard `deployment.environment` resource attribute for the environment and a consistent `deployment.version` attribute for the release.

You can then search or filter logs and traces by those values and compare metrics around the deployment window.

## Related pages

- [Deployment context](/docs/product/deployments)
- [Track a deployment](/docs/guides/track-a-deployment)
- [Environment variables](/docs/reference/environment-variables)
