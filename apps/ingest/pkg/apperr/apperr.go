package apperr

import "errors"

type Error interface {
	Code() string
	Status() int
	Error() string
}

type err struct {
	status int
	code   string
}

func New(status int, code string) Error {
	return &err{
		status: status,
		code:   code,
	}
}

func (e *err) Code() string  { return e.code }
func (e *err) Status() int   { return e.status }
func (e *err) Error() string { return e.code }

func Is(err error, target Error) bool {
	var appErr Error
	return errors.As(err, &appErr) && appErr.Status() == target.Status() && appErr.Code() == target.Code()
}
