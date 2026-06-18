package errs

import "github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"

var (
	ErrIngestionKeyNotFound        = apperr.New(401, "ingestion_key_not_found")
	ErrInvalidIngestionKey         = apperr.New(401, "invalid_ingestion_key")
	ErrPrivateIngestionKeyRequired = apperr.New(403, "private_ingestion_key_required")
	ErrInternal                    = apperr.New(500, "internal")
	ErrMalformedPayload            = apperr.New(400, "malformed_payload")
	ErrInvalidDeploymentPayload    = apperr.New(400, "invalid_deployment_payload")
	ErrDeploymentNotFound          = apperr.New(404, "deployment_not_found")
	ErrHeartbeatMonitorNotFound    = apperr.New(404, "heartbeat_monitor_not_found")
	ErrUnsupportedContentType      = apperr.New(415, "unsupported_content_type")
	ErrUnsupportedContentEncoding  = apperr.New(415, "unsupported_content_encoding")
	ErrPayloadTooLarge             = apperr.New(413, "payload_too_large")
	ErrQueueUnavailable            = apperr.New(503, "queue_unavailable")
	ErrBillingRequired             = apperr.New(402, "billing_required")
	ErrBillingQuotaExceeded        = apperr.New(402, "billing_quota_exceeded")
)
