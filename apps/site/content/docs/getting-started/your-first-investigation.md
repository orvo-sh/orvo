---
title: Your first investigation
description: Use Orvo to follow an issue from symptom to root cause.
order: 4
previous: getting-started/verify-your-setup
next: concepts/telemetry
---
# Your first investigation

A good first investigation should feel short, concrete, and repeatable. Here is the workflow Orvo is built around.

Scenario: a checkout request failed.

## Start with logs

Open [Logs](/docs/product/logs) and filter down to the failing service and environment.

For example:

- Service: `checkout-api`
- Environment: `production`
- Severity: error or warning
- Search: `Checkout failed` or `payment authorization declined`

You want the exact event that tells you what went wrong.

## Open the failing log

When you find the right log entry, inspect its structured fields.

Useful things to grab immediately:

- `request.id`
- `trace_id`
- `http.route`
- `http.status_code`
- `error.code`
- `deployment.version`

## Follow the trace context

If the log includes a trace ID, open the related trace next.

That tells you:

- Which service failed first.
- Where time was spent.
- Whether the problem came from your code, a dependency, or a slow downstream call.

This is the core move from symptom to cause.

## Check whether it is isolated or widespread

Open [Metrics](/docs/product/metrics) to answer:

- Is this a single request or a rising error rate?
- Did latency increase at the same time?
- Is only one service affected?

This stops you from overreacting to a one-off failure and helps you spot real regressions faster.

## Decide what changed

Look for recent change markers inside the telemetry itself:

- `deployment.version` attributes
- Environment changes
- A new route or span name
- A spike that lines up with an [Incident](/docs/product/incidents) or [Alert](/docs/product/alerts)

Even without a dedicated deployments surface, good deployment metadata makes this step much easier.

## A simple first-pass conclusion

A useful outcome might look like this:

```text
Checkout failures started after deployment 2026.07.07-1.
The trace shows the slow step is payment authorization.
The failing logs all have error.code=card_declined from the same provider path.
The issue is isolated to checkout-api in production.
```

That is enough to decide what to fix, who owns it, and whether to roll back.

## Related pages

- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
- [Metrics](/docs/product/metrics)
- [Find the root cause of an error](/docs/guides/find-the-root-cause-of-an-error)
