---
title: Verify your setup
description: Confirm that your app is correctly sending telemetry to Orvo.
order: 3
previous: getting-started/send-your-first-telemetry
next: getting-started/your-first-investigation
---
# Verify your setup

Useful data is more important than merely accepted data. This page helps you confirm that Orvo is receiving telemetry you can actually debug with.

## Check the service name

Open [Logs](/docs/product/logs) or [Traces](/docs/product/traces) and confirm your telemetry lands under the service you expected.

Good examples:

- `cartlane-web`
- `checkout-api`
- `payments-worker`

Weak examples:

- `app`
- `backend`
- `service-1`

## Check the environment

Make sure production and staging are separate.

Orvo stores the deployment environment from the standard OpenTelemetry resource attribute:

```text
deployment.environment
```

If you mix environments, every query becomes noisy and alerts become harder to trust.

## Check logs first

Logs are usually the fastest signal to verify because they are easy to recognize.

Look for:

- The right service.
- The right environment.
- A recent timestamp.
- A readable message body.
- Useful attributes such as request IDs, route names, or user IDs.

## Check traces next

Pick one request and verify that:

- The trace name makes sense.
- The root span belongs to the right service.
- Child spans show the major work done during the request.
- Errors appear with the right status.

## Check attributes

A small set of consistent attributes makes Orvo dramatically more useful.

Good first attributes include:

- `http.method`
- `http.route`
- `http.status_code`
- `user.id`
- `request.id`
- `trace_id`
- `deployment.version`

## Check the ingestion key

If the app sends no data at all, double-check the key first.

Orvo's ingest service expects a bearer token:

```bash
Authorization: Bearer YOUR_INGESTION_KEY
```

A wrong or revoked key will cause ingestion to fail before the signal reaches queryable storage.

## Common problems

### Nothing appears

Check these first:

- Wrong ingest URL.
- Wrong `Authorization` header.
- Telemetry is sending to the wrong environment.
- Your SDK initialized after requests already started.

### Logs appear but traces do not

That usually means the trace exporter or tracing SDK setup is incomplete.

### Traces appear but service names look wrong

You likely did not set `OTEL_SERVICE_NAME` or equivalent resource attributes clearly.

### Data appears but is hard to use

That is usually an attribute problem, not an ingestion problem. Add more structured context before you add more volume.

## What to do next

Once the setup looks right, run through [Your first investigation](/docs/getting-started/your-first-investigation) using a real or simulated error.
