package helpers

import (
	"mime"
	"net/http"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

func DecodeContentType(request *http.Request) (string, apperr.Error) {
	contentType := request.Header.Get("Content-Type")
	if contentType == "" {
		return "application/x-protobuf", nil
	}

	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", errs.ErrUnsupportedContentType
	}

	switch mediaType {
	case "application/json", "application/x-protobuf":
		return mediaType, nil
	default:
		return "", errs.ErrUnsupportedContentType
	}
}