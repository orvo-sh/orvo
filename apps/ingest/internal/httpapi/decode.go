package httpapi

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"strings"
	"time"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/orvo-sh/orvo/apps/ingest/internal/apperrors"
	"github.com/orvo-sh/orvo/apps/ingest/internal/telemetry"
)

const (
	contentTypeJSON     = "application/json"
	contentTypeProtobuf = "application/x-protobuf"
)

func readOTLPBody(writer http.ResponseWriter, request *http.Request, maxBodyBytes int64) ([]byte, apperrors.AppError) {
	request.Body = http.MaxBytesReader(writer, request.Body, maxBodyBytes)
	reader := io.Reader(request.Body)

	for _, encoding := range strings.Split(strings.ToLower(request.Header.Get("Content-Encoding")), ",") {
		encoding = strings.TrimSpace(encoding)
		switch encoding {
		case "", "identity":
			continue
		case "gzip":
			gzipReader, err := gzip.NewReader(reader)
			if err != nil {
				return nil, apperrors.ErrMalformedPayload
			}
			defer gzipReader.Close()
			reader = gzipReader
		default:
			return nil, apperrors.ErrUnsupportedContentEncoding
		}
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			return nil, apperrors.ErrPayloadTooLarge
		}
		return nil, apperrors.ErrMalformedPayload
	}

	return body, nil
}

func decodeContentType(request *http.Request) (string, apperrors.AppError) {
	contentType := request.Header.Get("Content-Type")
	if contentType == "" {
		return contentTypeProtobuf, nil
	}

	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", apperrors.ErrUnsupportedContentType
	}

	switch mediaType {
	case contentTypeJSON, contentTypeProtobuf:
		return mediaType, nil
	default:
		return "", apperrors.ErrUnsupportedContentType
	}
}

func unmarshalOTLP(contentType string, body []byte, message proto.Message) apperrors.AppError {
	switch contentType {
	case contentTypeJSON:
		options := protojson.UnmarshalOptions{DiscardUnknown: true}
		if err := options.Unmarshal(body, message); err != nil {
			return apperrors.ErrMalformedPayload
		}
	case contentTypeProtobuf:
		if err := proto.Unmarshal(body, message); err != nil {
			return apperrors.ErrMalformedPayload
		}
	default:
		return apperrors.ErrUnsupportedContentType
	}

	return nil
}

func requestMeta(request *http.Request, contentType string) telemetry.MessageMeta {
	contentEncoding := strings.TrimSpace(strings.ToLower(request.Header.Get("Content-Encoding")))
	return telemetry.MessageMeta{
		ReceivedAt:      time.Now().UTC(),
		ContentType:     contentType,
		ContentEncoding: contentEncoding,
		RemoteAddr:      remoteAddr(request.RemoteAddr),
		UserAgent:       request.UserAgent(),
	}
}

func remoteAddr(value string) string {
	host, _, err := net.SplitHostPort(value)
	if err == nil {
		return host
	}

	return value
}

func writeOTLPResponse(writer http.ResponseWriter, requestContentType string, message proto.Message) {
	if requestContentType == contentTypeJSON {
		writer.Header().Set("Content-Type", contentTypeJSON)
		bytes, err := protojson.Marshal(message)
		if err != nil {
			http.Error(writer, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}
		writer.WriteHeader(http.StatusAccepted)
		_, _ = writer.Write(bytes)
		return
	}

	writer.Header().Set("Content-Type", contentTypeProtobuf)
	bytes, err := proto.Marshal(message)
	if err != nil {
		http.Error(writer, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return
	}
	writer.WriteHeader(http.StatusAccepted)
	_, _ = writer.Write(bytes)
}

func writeAppError(writer http.ResponseWriter, appErr apperrors.AppError) {
	writer.Header().Set("Content-Type", contentTypeJSON)
	writer.WriteHeader(appErr.Status())
	_ = json.NewEncoder(writer).Encode(map[string]string{
		"error": appErr.Code(),
	})
}

func emptyLogsResponse() proto.Message {
	return &collectorlogspb.ExportLogsServiceResponse{}
}

func emptyTracesResponse() proto.Message {
	return &collectortracepb.ExportTraceServiceResponse{}
}

func emptyMetricsResponse() proto.Message {
	return &collectormetricspb.ExportMetricsServiceResponse{}
}
