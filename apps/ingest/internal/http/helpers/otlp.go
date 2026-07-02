package helpers

import (
	"compress/gzip"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

func ReadOTLPBody(writer http.ResponseWriter, request *http.Request) ([]byte, apperr.Error) {
	request.Body = http.MaxBytesReader(writer, request.Body, 10*1024*1024)

	reader := io.Reader(request.Body)
	for _, encoding := range strings.Split(strings.ToLower(request.Header.Get("Content-Encoding")), ",") {
		encoding = strings.TrimSpace(encoding)
		switch encoding {
		case "", "identity":
		case "gzip":
			gzipReader, err := gzip.NewReader(reader)
			if err != nil {
				return nil, errs.ErrMalformedPayload
			}
			defer gzipReader.Close()
			reader = gzipReader
		default:
			return nil, errs.ErrUnsupportedContentEncoding
		}
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			return nil, errs.ErrPayloadTooLarge
		}
		return nil, errs.ErrMalformedPayload
	}

	return body, nil
}

func UnmarshalOTLP(contentType string, body []byte, message proto.Message) apperr.Error {
	switch contentType {
	case "application/json":
		normalizedBody, err := normalizeOTLPJSON(body)
		if err != nil {
			return errs.ErrMalformedPayload
		}
		if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(normalizedBody, message); err != nil {
			return errs.ErrMalformedPayload
		}
	case "application/x-protobuf":
		if err := proto.Unmarshal(body, message); err != nil {
			return errs.ErrMalformedPayload
		}
	default:
		return errs.ErrUnsupportedContentType
	}

	return nil
}

func normalizeOTLPJSON(body []byte) ([]byte, error) {
	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	normalizeOTLPJSONValue(payload)

	return json.Marshal(payload)
}

func normalizeOTLPJSONValue(value any) {
	switch current := value.(type) {
	case map[string]any:
		for key, child := range current {
			switch key {
			case "traceId", "trace_id":
				current[key] = normalizeOTLPJSONIDString(child, 16)
			case "spanId", "span_id", "parentSpanId", "parent_span_id":
				current[key] = normalizeOTLPJSONIDString(child, 8)
			default:
				normalizeOTLPJSONValue(child)
			}
		}
	case []any:
		for _, child := range current {
			normalizeOTLPJSONValue(child)
		}
	}
}

func normalizeOTLPJSONIDString(value any, expectedByteLength int) any {
	raw, ok := value.(string)
	if !ok || raw == "" || len(raw) != expectedByteLength*2 {
		return value
	}

	decoded, err := hex.DecodeString(raw)
	if err != nil || len(decoded) != expectedByteLength {
		return value
	}

	return base64.StdEncoding.EncodeToString(decoded)
}

func WriteOTLPResponse(writer http.ResponseWriter, requestContentType string, message proto.Message) {
	if requestContentType == "application/json" {
		bytes, err := protojson.Marshal(message)
		if err != nil {
			writer.WriteHeader(http.StatusInternalServerError)
			return
		}

		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusAccepted)
		_, _ = writer.Write(bytes)
		return
	}

	bytes, err := proto.Marshal(message)
	if err != nil {
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	writer.Header().Set("Content-Type", "application/x-protobuf")
	writer.WriteHeader(http.StatusAccepted)
	_, _ = writer.Write(bytes)
}
