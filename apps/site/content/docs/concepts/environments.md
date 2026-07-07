---
title: Environments
description: Use environments to separate production, staging, development, and other runtime contexts.
order: 3
previous: concepts/services
next: concepts/attributes
---
# Environments

Environments separate production from everything else.

## Why it matters

If staging and production share the same queries, you will spend time chasing noise instead of real issues.

Environment separation matters for:

- Query clarity
- Alert accuracy
- Incident triage
- Deployment comparisons

## How Orvo uses it

Orvo stores deployment environment from the standard OpenTelemetry attribute `deployment.environment`.

Common values are:

- `production`
- `staging`
- `development`

Use a small stable set. Avoid accidental variations like `prod`, `production-eu`, and `Production` unless you truly want them to be separate.

## Example

A trace for `POST /api/checkout` should show the same service structure in staging and production, but you should be able to filter them independently.

That makes it easy to answer whether a problem is:

- Only in production
- Reproduced in staging
- Introduced by a config difference

## Related pages

- [Attributes](/docs/concepts/attributes)
- [Verify your setup](/docs/getting-started/verify-your-setup)
- [Metrics](/docs/product/metrics)
