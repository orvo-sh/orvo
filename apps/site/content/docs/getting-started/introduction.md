---
title: Introduction
description: Introduction to Orvo, how it works, and how it uses OpenTelemetry.
order: 1
next: getting-started/send-your-first-telemetry
---
# Introduction

Orvo is an observability product for small teams that want to understand production quickly without learning a giant enterprise platform first.

It brings the core signals together in one place:

- Logs for the exact events around a problem.
- Traces for request and job timelines.
- Metrics for trend, saturation, and service health.
- Heartbeats for cron jobs and recurring workers.
- Incident and alert workflows for staying on top of live issues.

Orvo is built around OpenTelemetry. That matters because you can send vendor-neutral telemetry instead of locking your application to a custom logging or tracing format.

## Who Orvo is for

Orvo fits teams that want to go from `something broke` to `I know why` fast.

That usually means:

- A startup or indie product with a handful of services.
- An engineering team that wants useful defaults instead of a long platform project.
- A developer who needs enough context to debug production in minutes, not hours.

## The basic flow

Most teams start the same way:

1. Instrument an app with OpenTelemetry.
2. Send telemetry to Orvo's ingest endpoint.
3. Verify that service names, environments, and attributes look right.
4. Use [Logs](/docs/product/logs), [Traces](/docs/product/traces), and [Metrics](/docs/product/metrics) to investigate real traffic.
5. Add [Alerts](/docs/product/alerts) and [Heartbeats](/docs/product/heartbeats) once the basics are in place.

## What Orvo collects

Orvo currently works best when you send:

- Logs with useful structured attributes.
- Traces with clear span names and service boundaries.
- Metrics for latency, throughput, and infrastructure health.
- Heartbeat check-ins for scheduled work.
- Deployment and environment metadata inside your telemetry attributes.

:::info
The best early win is not sending every signal at once. Start with one production service, confirm the data is readable, then expand from there.
:::

## How the product is organized

A useful mental model is:

- [Getting started](/docs/getting-started/introduction) for the shortest path to useful data.
- [Concepts](/docs/concepts/telemetry) for Orvo vocabulary.
- [OpenTelemetry](/docs/opentelemetry/overview) for instrumentation patterns.
- [Product](/docs/product/overview) for feature-by-feature workflows.
- [Guides](/docs/guides/investigate-a-production-incident) for real debugging tasks.
- [Reference](/docs/reference/api) for exact details when you need them.

## What to do next

Go straight to [Send your first telemetry](/docs/getting-started/send-your-first-telemetry). That page is the fastest path from an empty workspace to data you can actually inspect.
