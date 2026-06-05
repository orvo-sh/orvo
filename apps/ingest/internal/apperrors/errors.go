package apperrors

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

func New(status int, code string) AppError {
	return &appErr{status: status, code: code}
}

func Is(err error, target AppError) bool {
	var appErr AppError
	return errors.As(err, &appErr) && appErr.Status() == target.Status() && appErr.Code() == target.Code()
}

var (
	ErrIngestionKeyNotFound       = New(401, "ingestion_key_not_found")
	ErrInvalidIngestionKey        = New(401, "invalid_ingestion_key")
	ErrInternal                   = New(500, "internal")
	ErrMalformedPayload           = New(400, "malformed_payload")
	ErrUnsupportedContentType     = New(415, "unsupported_content_type")
	ErrUnsupportedContentEncoding = New(415, "unsupported_content_encoding")
	ErrPayloadTooLarge            = New(413, "payload_too_large")
	ErrQueueUnavailable           = New(503, "queue_unavailable")
	ErrBillingRequired            = New(402, "billing_required")
	ErrBillingQuotaExceeded       = New(402, "billing_quota_exceeded")
)
