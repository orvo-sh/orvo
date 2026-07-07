---
title: Deployments
description: Track releases and their impact on production health.
order: 9
previous: product/incidents
next: product/insights
---
# Deployments

Deployments are the missing link between `something changed` and `that is probably why production shifted`.

## Current product shape

Orvo's current strength is not a large standalone deployments UI. The practical workflow today is to carry deployment context inside your telemetry and use it across logs, traces, metrics, and incidents.

Useful deployment fields include:

- `deployment.environment`
- `deployment.version`
- commit or release identifiers you attach as attributes

## When to use it

Deployment context matters when you need to answer:

- Did errors start after a release?
- Which version is failing?
- Is only production affected?
- Did latency change after a rollout?

## How to use it in Orvo today

### Put release data in telemetry

If your logs and traces carry the deployment version, Orvo queries become much more useful.

### Compare before and after

Use [Logs](/docs/product/logs) and [Metrics](/docs/product/metrics) around the release window.

### Link incidents to change windows

If an [Incident](/docs/product/incidents) starts right after a deployment and the failing events share the same release attribute, you have a strong first clue.

## Best practices

- Add version or release IDs to logs and spans.
- Keep environment naming stable.
- Include deployment metadata in the services that own customer-critical paths first.

## Related pages

- [Track a deployment](/docs/guides/track-a-deployment)
- [Metrics](/docs/product/metrics)
- [Find the root cause of an error](/docs/guides/find-the-root-cause-of-an-error)
