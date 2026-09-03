---
title: Deployment context
description: Add release metadata to telemetry and measure the impact of a deployment.
order: 9
previous: product/incidents
next: product/scout
---
# Deployment context

Release metadata connects a change in production health to the version that introduced it. Orvo reads deployment context from your telemetry; you do not need to create a deployment record in the app.

Add these resource attributes to logs, traces, and metrics where possible:

- `deployment.environment`
- `deployment.version`
- commit or release identifiers you attach as attributes

## When to use it

Deployment context matters when you need to answer:

- Did errors start after a release?
- Which version is failing?
- Is only production affected?
- Did latency change after a rollout?

## Investigate a deployment

### Put release data in telemetry

Set the version or release identifier in the instrumentation for every deployed service. Use one consistent value across logs and traces from the same release.

### Compare before and after

Use [Logs](/docs/product/logs) and [Metrics](/docs/product/metrics) around the release window.

### Link incidents to change windows

If an [Incident](/docs/product/incidents) starts after a deployment, filter the related telemetry by version. A problem isolated to the new version is a strong signal to inspect or roll back that release.

## Best practices

- Add version or release IDs to logs and spans.
- Keep environment naming stable.
- Include deployment metadata in the services that own customer-critical paths first.

## Related pages

- [Track a deployment](/docs/guides/track-a-deployment)
- [Metrics](/docs/product/metrics)
- [Find the root cause of an error](/docs/guides/find-the-root-cause-of-an-error)
