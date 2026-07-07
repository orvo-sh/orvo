---
title: Error codes
description: Reference for Orvo error codes and common fixes.
order: 4
previous: reference/limits
next: reference/changelog
---
# Error codes

These are the exact ingest-service error identifiers currently visible in the codebase.

## Ingestion and auth

### `ingestion_key_not_found`

- HTTP status: 401
- Meaning: the provided ingestion key does not map to an active key
- Common fix: use the right key and confirm it has not been revoked

### `invalid_ingestion_key`

- HTTP status: 401
- Meaning: the auth header is malformed or the key format is invalid
- Common fix: send `Authorization: Bearer YOUR_INGESTION_KEY`

## Payload problems

### `malformed_payload`

- HTTP status: 400
- Meaning: the OTLP body could not be parsed
- Common fix: verify content type, encoding, and exporter format

### `unsupported_content_type`

- HTTP status: 415
- Meaning: the request content type is not supported
- Common fix: use a standard OTLP HTTP content type

### `unsupported_content_encoding`

- HTTP status: 415
- Meaning: the request used an unsupported content encoding
- Common fix: remove the unsupported encoding or switch exporters

### `payload_too_large`

- HTTP status: 413
- Meaning: the request body exceeded the accepted size
- Common fix: reduce batch size or export more frequently

## Availability and billing

### `queue_unavailable`

- HTTP status: 503
- Meaning: the ingest service could not accept the payload into its processing queue
- Common fix: retry with backoff

### `billing_required`

- HTTP status: 402
- Meaning: the current plan state does not allow the requested ingest behavior
- Common fix: check plan state and billing configuration

### `billing_quota_exceeded`

- HTTP status: 402
- Meaning: the app or organization exceeded an implemented usage limit
- Common fix: reduce ingest volume or move to a higher plan

## Heartbeats

### `heartbeat_monitor_not_found`

- HTTP status: 404
- Meaning: the heartbeat token does not map to a valid monitor
- Common fix: regenerate the monitor URL or update the calling job

## Related pages

- [API](/docs/reference/api)
- [Verify your setup](/docs/getting-started/verify-your-setup)
- [Limits](/docs/reference/limits)
