---
title: Services
description: Learn how Orvo groups telemetry by service.
order: 2
previous: concepts/telemetry
next: concepts/environments
---
# Services

A service is the unit Orvo uses to group related telemetry from one app, API, worker, or job runner.

## Why it matters

Most investigations start by narrowing down to the service that owns the problem.

If your service naming is inconsistent, queries become noisy and cross-service traces are harder to read.

## How Orvo uses it

Orvo reads the service name from OpenTelemetry resource attributes. In practice, that means you should set a clear value for `service.name` or your SDK's equivalent configuration.

Good service names are:

- Stable
- Human-readable
- Close to how your team talks about the system

Examples:

- `cartlane-web`
- `checkout-api`
- `payments-worker`
- `inventory-api`

## Example

If a request moves through `cartlane-web`, `checkout-api`, and `payments-worker`, Orvo can show:

- Logs for each service
- Trace spans grouped by service
- Metrics filtered to one service or compared across services

## Related pages

- [Environments](/docs/concepts/environments)
- [Traces](/docs/product/traces)
- [Production best practices](/docs/guides/production-best-practices)
