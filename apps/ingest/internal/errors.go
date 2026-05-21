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

func NewAppError(status int, code string) AppError {
	return &appErr{
		status: status,
		code:   code,
	}
}

func IsAppError(err error, target AppError) bool {
	var appErr AppError
	return errors.As(err, &appErr) && appErr.Status() == target.Status() && appErr.Code() == target.Code()
}

var (
	ErrAPIKeyNotFound             = NewAppError(401, "api_key_not_found")
	ErrInvalidAPIKey              = NewAppError(401, "invalid_api_key")
	ErrInternal                   = NewAppError(500, "internal")
	ErrMalformedPayload           = NewAppError(400, "malformed_payload")
	ErrUnsupportedContentType     = NewAppError(415, "unsupported_content_type")
	ErrUnsupportedContentEncoding = NewAppError(415, "unsupported_content_encoding")
	ErrPayloadTooLarge            = NewAppError(413, "payload_too_large")
	ErrQueueUnavailable           = NewAppError(503, "queue_unavailable")
)
