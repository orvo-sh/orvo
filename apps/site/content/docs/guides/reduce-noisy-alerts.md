---
title: Reduce noisy alerts
description: Tune alerts so your team only gets paged for things that matter.
order: 7
previous: guides/create-useful-alerts
next: guides/production-best-practices
---
# Reduce noisy alerts

Noisy alerts train a team to ignore the product. This guide is about making fewer rules work better.

## When to use this guide

Use it when the alert technically works, but fires too often to be trusted.

## Before you start

Review one alert that fired repeatedly in the last few days and decide whether it represented real action each time.

## Step 1: tighten the condition

Usually the fastest fix is one of:

- a better threshold
- a longer window
- narrower service or environment scope

## Step 2: route less broadly

Not every warning belongs in a team-wide channel or inbox.

Use different destinations for:

- broad visibility
- immediate response
- automation only

## Step 3: convert repeated noise into a better incident workflow

If the same rule fires repeatedly for the same condition, check whether the incident behavior is already enough without frequent repeat notifications.

## What to check next

After tuning, review whether the alert still catches the real issue it was meant to catch.

## Related pages

- [Create useful alerts](/docs/guides/create-useful-alerts)
- [Alerts](/docs/product/alerts)
- [Incidents](/docs/product/incidents)
