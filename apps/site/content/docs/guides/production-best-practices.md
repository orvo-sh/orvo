---
title: Production best practices
description: Recommended practices for using Orvo in production.
order: 8
previous: guides/reduce-noisy-alerts
next: integrations/slack
---
# Production best practices

These practices make Orvo more useful long before you need a difficult investigation.

## Use service names consistently

Pick stable service names and keep them aligned with how the team talks about the system.

## Always set the environment

Use `deployment.environment` and keep the values small and predictable.

## Add useful attributes

Start with request, route, user, and business identifiers that actually help you debug.

## Do not log secrets

Keep raw tokens, API secrets, and sensitive customer data out of logs.

## Connect logs with traces

A log with a trace ID is much easier to work with than a log without one.

## Track deployment context

Include version or release identifiers in telemetry so regressions are faster to confirm.

## Start with a few strong alerts

Do not build ten mediocre rules when three good ones would cover the important failures.

## Review incidents after they resolve

Every incident is a chance to improve naming, attributes, thresholds, or ownership.

## Related pages

- [Attributes](/docs/concepts/attributes)
- [Deployments](/docs/product/deployments)
- [Create useful alerts](/docs/guides/create-useful-alerts)
