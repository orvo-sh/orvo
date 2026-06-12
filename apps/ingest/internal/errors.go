package ingest

import "errors"

type AppError interface {
	Code() string
	Status() int
	Error() string
}

type appErr struct {
	status int
	code   string
}

func (err *appErr) Code() string  { return err.code }
func (err *appErr) Status() int   { return err.status }
func (err *appErr) Error() string { return err.code }

func newAppError(status int, code string) AppError {
	return &appErr{status: status, code: code}
}

func IsAppError(err error, target AppError) bool {
	var appErr AppError
	return errors.As(err, &appErr) && appErr.Status() == target.Status() && appErr.Code() == target.Code()
}

var (
	ErrIngestionKeyNotFound       = newAppError(401, "ingestion_key_not_found")
	ErrInvalidIngestionKey        = newAppError(401, "invalid_ingestion_key")
	ErrInternal                   = newAppError(500, "internal")
	ErrMalformedPayload           = newAppError(400, "malformed_payload")
	ErrUnsupportedContentType     = newAppError(415, "unsupported_content_type")
	ErrUnsupportedContentEncoding = newAppError(415, "unsupported_content_encoding")
	ErrPayloadTooLarge            = newAppError(413, "payload_too_large")
	ErrQueueUnavailable           = newAppError(503, "queue_unavailable")
	ErrBillingRequired            = newAppError(402, "billing_required")
	ErrBillingQuotaExceeded       = newAppError(402, "billing_quota_exceeded")
)
