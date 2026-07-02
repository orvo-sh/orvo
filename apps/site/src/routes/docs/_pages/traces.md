---
title: Traces
description: Inspect request paths across services and isolate where latency or failure began.
category: Signals
order: 2
slug: traces
previous: signals/logs
next: signals/metrics
---

# Traces

Traces let you follow one request across application boundaries and understand where the outcome changed.

## Read the full request path

Look for the span where latency started expanding or the dependency call where a failure first surfaced. That is usually the narrowest place to begin.

## Use traces to validate deploy impact

After a deploy, compare trace behavior before and after the change so you can tell whether latency or failure patterns actually moved.
