package ingest

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const (
	contentTypeJSON     = "application/json"
	contentTypeProtobuf = "application/x-protobuf"
)

type signalHandler struct {
	authService   *AuthService
	ingestService *TelemetryService
	maxBodyBytes  int64
	signal        string
}

func (handler *signalHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	resolved, err := handler.authService.ResolveRequest(request)
	if err != nil {
		writeAppError(writer, ErrInvalidIngestionKey)
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
		if ingestErr := handler.ingestService.IngestLogs(request.Context(), LogsInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceLogs:         payload.GetResourceLogs(),
		}); ingestErr != nil {
			writeAppError(writer, ingestErr)
			return
		}
		writeOTLPResponse(writer, contentType, emptyLogsResponse())
	case "traces":
		var payload collectortracepb.ExportTraceServiceRequest
		if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		if ingestErr := handler.ingestService.IngestTraces(request.Context(), TracesInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceSpans:        payload.GetResourceSpans(),
		}); ingestErr != nil {
			writeAppError(writer, ingestErr)
			return
		}
		writeOTLPResponse(writer, contentType, emptyTracesResponse())
	case "metrics":
		var payload collectormetricspb.ExportMetricsServiceRequest
		if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		if ingestErr := handler.ingestService.IngestMetrics(request.Context(), MetricsInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceMetrics:      payload.GetResourceMetrics(),
		}); ingestErr != nil {
			writeAppError(writer, ingestErr)
			return
		}
		writeOTLPResponse(writer, contentType, emptyMetricsResponse())
	}
}

func readOTLPBody(writer http.ResponseWriter, request *http.Request, maxBodyBytes int64) ([]byte, AppError) {
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
				return nil, ErrMalformedPayload
			}
			defer gzipReader.Close()
			reader = gzipReader
		default:
			return nil, ErrUnsupportedContentEncoding
		}
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			return nil, ErrPayloadTooLarge
		}
		return nil, ErrMalformedPayload
	}

	return body, nil
}

func decodeContentType(request *http.Request) (string, AppError) {
	contentType := request.Header.Get("Content-Type")
	if contentType == "" {
		return contentTypeProtobuf, nil
	}

	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", ErrUnsupportedContentType
	}

	switch mediaType {
	case contentTypeJSON, contentTypeProtobuf:
		return mediaType, nil
	default:
		return "", ErrUnsupportedContentType
	}
}

func unmarshalOTLP(contentType string, body []byte, message proto.Message) AppError {
	switch contentType {
	case contentTypeJSON:
		options := protojson.UnmarshalOptions{DiscardUnknown: true}
		if err := options.Unmarshal(body, message); err != nil {
			return ErrMalformedPayload
		}
	case contentTypeProtobuf:
		if err := proto.Unmarshal(body, message); err != nil {
			return ErrMalformedPayload
		}
	default:
		return ErrUnsupportedContentType
	}

	return nil
}

func requestMeta() MessageMeta {
	return MessageMeta{
		ReceivedAt: time.Now().UTC(),
	}
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

func writeAppError(writer http.ResponseWriter, appErr AppError) {
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
