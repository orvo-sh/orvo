package telemetry

import (
	"encoding/hex"
	"time"

	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

func (service *Service) transformLogs(resourceLogs []*logspb.ResourceLogs) []LogRecord {
	var records []LogRecord

	for _, resourceLog := range resourceLogs {
		resource := resourceLog.GetResource()
		resourceAttributes := KvListToMap(resource.GetAttributes())
		resourceSchemaURL := resourceLog.GetSchemaUrl()
		serviceName := resourceAttributes["service.name"]
		deploymentEnvironment := resourceAttributes["deployment.environment"]

		for _, scopeLog := range resourceLog.GetScopeLogs() {
			scope := scopeLog.GetScope()
			scopeName := scope.GetName()
			scopeVersion := scope.GetVersion()
			scopeAttributes := KvListToMap(scope.GetAttributes())
			scopeSchemaURL := scopeLog.GetSchemaUrl()

			for _, logRecord := range scopeLog.GetLogRecords() {
				timestamp := NanoToTime(logRecord.GetTimeUnixNano())
				observedTimestamp := NanoToTime(logRecord.GetObservedTimeUnixNano())
				if observedTimestamp.IsZero() {
					observedTimestamp = time.Now().UTC()
				}
				if timestamp.IsZero() {
					timestamp = observedTimestamp
				}

				records = append(records, LogRecord{
					Timestamp:             timestamp,
					ObservedTimestamp:     observedTimestamp,
					SeverityNumber:        uint8(logRecord.GetSeverityNumber()),
					SeverityText:          logRecord.GetSeverityText(),
					Body:                  AnyValueToString(logRecord.GetBody()),
					TraceID:               hex.EncodeToString(logRecord.GetTraceId()),
					SpanID:                hex.EncodeToString(logRecord.GetSpanId()),
					TraceFlags:            logRecord.GetFlags(),
					ResourceAttributes:    resourceAttributes,
					ResourceSchemaURL:     resourceSchemaURL,
					ScopeName:             scopeName,
					ScopeVersion:          scopeVersion,
					ScopeAttributes:       scopeAttributes,
					ScopeSchemaURL:        scopeSchemaURL,
					LogAttributes:         KvListToMap(logRecord.GetAttributes()),
					ServiceName:           serviceName,
					DeploymentEnvironment: deploymentEnvironment,
				})
			}
		}
	}

	return records
}

func (service *Service) transformTraces(resourceSpans []*tracepb.ResourceSpans) []Span {
	var spans []Span

	for _, resourceSpan := range resourceSpans {
		resource := resourceSpan.GetResource()
		resourceAttributes := KvListToMap(resource.GetAttributes())
		resourceSchemaURL := resourceSpan.GetSchemaUrl()
		serviceName := resourceAttributes["service.name"]
		deploymentEnvironment := resourceAttributes["deployment.environment"]

		for _, scopeSpan := range resourceSpan.GetScopeSpans() {
			scope := scopeSpan.GetScope()
			scopeName := scope.GetName()
			scopeVersion := scope.GetVersion()
			scopeAttributes := KvListToMap(scope.GetAttributes())
			scopeSchemaURL := scopeSpan.GetSchemaUrl()

			for _, span := range scopeSpan.GetSpans() {
				startTime := NanoToTime(span.GetStartTimeUnixNano())
				endTime := NanoToTime(span.GetEndTimeUnixNano())
				if startTime.IsZero() {
					startTime = time.Now().UTC()
				}
				if endTime.IsZero() {
					endTime = startTime
				}

				events := make([]SpanEvent, 0, len(span.GetEvents()))
				for _, event := range span.GetEvents() {
					events = append(events, SpanEvent{
						Name:       event.GetName(),
						Timestamp:  NanoToTime(event.GetTimeUnixNano()),
						Attributes: KvListToMap(event.GetAttributes()),
					})
				}

				links := make([]SpanLink, 0, len(span.GetLinks()))
				for _, link := range span.GetLinks() {
					links = append(links, SpanLink{
						TraceID:    hex.EncodeToString(link.GetTraceId()),
						SpanID:     hex.EncodeToString(link.GetSpanId()),
						TraceState: link.GetTraceState(),
						Attributes: KvListToMap(link.GetAttributes()),
					})
				}

				statusCode := uint8(0)
				statusMessage := ""
				if status := span.GetStatus(); status != nil {
					statusCode = uint8(status.GetCode())
					statusMessage = status.GetMessage()
				}

				spans = append(spans, Span{
					TraceID:               hex.EncodeToString(span.GetTraceId()),
					SpanID:                hex.EncodeToString(span.GetSpanId()),
					ParentSpanID:          hex.EncodeToString(span.GetParentSpanId()),
					TraceState:            span.GetTraceState(),
					Name:                  span.GetName(),
					Kind:                  uint8(span.GetKind()),
					StartTime:             startTime,
					EndTime:               endTime,
					DurationNs:            endTime.Sub(startTime).Nanoseconds(),
					StatusCode:            statusCode,
					StatusMessage:         statusMessage,
					ResourceAttributes:    resourceAttributes,
					ScopeAttributes:       scopeAttributes,
					SpanAttributes:        KvListToMap(span.GetAttributes()),
					ResourceSchemaURL:     resourceSchemaURL,
					ScopeName:             scopeName,
					ScopeVersion:          scopeVersion,
					ScopeSchemaURL:        scopeSchemaURL,
					Events:                events,
					Links:                 links,
					ServiceName:           serviceName,
					DeploymentEnvironment: deploymentEnvironment,
				})
			}
		}
	}

	return spans
}

func mapAggregationTemporality(temporality metricspb.AggregationTemporality) string {
	switch temporality {
	case metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_DELTA:
		return AggTemporalityDelta.String()
	case metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_CUMULATIVE:
		return AggTemporalityCumulative.String()
	default:
		return AggTemporalityUnspecified.String()
	}
}

func transformExemplars(exemplars []*metricspb.Exemplar) []MetricExemplar {
	if len(exemplars) == 0 {
		return nil
	}

	out := make([]MetricExemplar, 0, len(exemplars))
	for _, exemplar := range exemplars {
		out = append(out, MetricExemplar{
			TraceID:   hex.EncodeToString(exemplar.GetTraceId()),
			SpanID:    hex.EncodeToString(exemplar.GetSpanId()),
			Value:     exemplarValue(exemplar),
			Timestamp: NanoToTime(exemplar.GetTimeUnixNano()),
		})
	}

	return out
}

func exemplarValue(exemplar *metricspb.Exemplar) float64 {
	switch value := exemplar.GetValue().(type) {
	case *metricspb.Exemplar_AsInt:
		return float64(value.AsInt)
	case *metricspb.Exemplar_AsDouble:
		return value.AsDouble
	default:
		return 0
	}
}
