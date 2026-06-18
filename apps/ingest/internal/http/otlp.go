package ingesthttp

import (
	"compress/gzip"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/authservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

type signalHandler struct {
	authService   authservice.Service
	ingestService ingestservice.Service
	maxBodyBytes  int64
	signal        string
}

func (handler *signalHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	resolved, err := handler.authService.ResolveRequest(request)
	if err != nil {
		writeAppError(writer, errs.ErrInvalidIngestionKey)
		return
	}

	contentType, appErr := decodeContentType(request)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	body, appErr := readOTLPBody(writer, request, handler.maxBodyBytes)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	switch handler.signal {
	case "logs":
		var payload collectorlogspb.ExportLogsServiceRequest
		if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		if appErr := handler.ingestService.IngestLogs(request.Context(), ingestservice.IngestLogsInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceLogs:         payload.GetResourceLogs(),
		}); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		writeOTLPResponse(writer, contentType, &collectorlogspb.ExportLogsServiceResponse{})
	case "traces":
		var payload collectortracepb.ExportTraceServiceRequest
		if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		if appErr := handler.ingestService.IngestTraces(request.Context(), ingestservice.IngestTracesInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceSpans:        payload.GetResourceSpans(),
		}); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		writeOTLPResponse(writer, contentType, &collectortracepb.ExportTraceServiceResponse{})
	case "metrics":
		var payload collectormetricspb.ExportMetricsServiceRequest
		if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		if appErr := handler.ingestService.IngestMetrics(request.Context(), ingestservice.IngestMetricsInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceMetrics:      payload.GetResourceMetrics(),
		}); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		writeOTLPResponse(writer, contentType, &collectormetricspb.ExportMetricsServiceResponse{})
	default:
		writeAppError(writer, errs.ErrInternal)
	}
}

func decodeContentType(request *http.Request) (string, apperr.Error) {
	contentType := request.Header.Get("Content-Type")
	if contentType == "" {
		return contentTypeProtobuf, nil
	}

	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", errs.ErrUnsupportedContentType
	}

	switch mediaType {
	case contentTypeJSON, contentTypeProtobuf:
		return mediaType, nil
	default:
		return "", errs.ErrUnsupportedContentType
	}
}

func readOTLPBody(writer http.ResponseWriter, request *http.Request, maxBodyBytes int64) ([]byte, apperr.Error) {
	request.Body = http.MaxBytesReader(writer, request.Body, maxBodyBytes)

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

func unmarshalOTLP(contentType string, body []byte, message proto.Message) apperr.Error {
	switch contentType {
	case contentTypeJSON:
		if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(body, message); err != nil {
			return errs.ErrMalformedPayload
		}
	case contentTypeProtobuf:
		if err := proto.Unmarshal(body, message); err != nil {
			return errs.ErrMalformedPayload
		}
	default:
		return errs.ErrUnsupportedContentType
	}

	return nil
}

func writeOTLPResponse(writer http.ResponseWriter, requestContentType string, message proto.Message) {
	if requestContentType == contentTypeJSON {
		bytes, err := protojson.Marshal(message)
		if err != nil {
			writer.WriteHeader(http.StatusInternalServerError)
			return
		}

		writer.Header().Set("Content-Type", contentTypeJSON)
		writer.WriteHeader(http.StatusAccepted)
		_, _ = writer.Write(bytes)
		return
	}

	bytes, err := proto.Marshal(message)
	if err != nil {
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}

	writer.Header().Set("Content-Type", contentTypeProtobuf)
	writer.WriteHeader(http.StatusAccepted)
	_, _ = writer.Write(bytes)
}
