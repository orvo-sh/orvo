package ingestservice

import (
	"encoding/hex"
	"math"
	"strconv"
	"strings"
	"time"

	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) transformLogs(resourceLogs []*logspb.ResourceLogs) []models.LogRecord {
	var records []models.LogRecord

	for _, resourceLog := range resourceLogs {
		resource := resourceLog.GetResource()
		resourceAttributes := kvListToMap(resource.GetAttributes())
		resourceSchemaURL := resourceLog.GetSchemaUrl()
		serviceName := resourceAttributes["service.name"]
		deploymentEnvironment := resourceAttributes["deployment.environment"]

		for _, scopeLog := range resourceLog.GetScopeLogs() {
			scope := scopeLog.GetScope()
			scopeName := scope.GetName()
			scopeVersion := scope.GetVersion()
			scopeAttributes := kvListToMap(scope.GetAttributes())
			scopeSchemaURL := scopeLog.GetSchemaUrl()

			for _, logRecord := range scopeLog.GetLogRecords() {
				timestamp := util.NanoToTime(logRecord.GetTimeUnixNano())
				observedTimestamp := util.NanoToTime(logRecord.GetObservedTimeUnixNano())
				if observedTimestamp.IsZero() {
					observedTimestamp = time.Now().UTC()
				}
				if timestamp.IsZero() {
					timestamp = observedTimestamp
				}

				records = append(records, models.LogRecord{
					Timestamp:             timestamp,
					ObservedTimestamp:     observedTimestamp,
					SeverityNumber:        uint8(logRecord.GetSeverityNumber()),
					SeverityText:          logRecord.GetSeverityText(),
					Body:                  anyValueToString(logRecord.GetBody()),
					TraceID:               hex.EncodeToString(logRecord.GetTraceId()),
					SpanID:                hex.EncodeToString(logRecord.GetSpanId()),
					TraceFlags:            logRecord.GetFlags(),
					ResourceAttributes:    resourceAttributes,
					ResourceSchemaURL:     resourceSchemaURL,
					ScopeName:             scopeName,
					ScopeVersion:          scopeVersion,
					ScopeAttributes:       scopeAttributes,
					ScopeSchemaURL:        scopeSchemaURL,
					LogAttributes:         kvListToMap(logRecord.GetAttributes()),
					ServiceName:           serviceName,
					DeploymentEnvironment: deploymentEnvironment,
				})
			}
		}
	}

	return records
}

func (service *service) transformTraces(resourceSpans []*tracepb.ResourceSpans) []models.Span {
	var spans []models.Span

	for _, resourceSpan := range resourceSpans {
		resource := resourceSpan.GetResource()
		resourceAttributes := kvListToMap(resource.GetAttributes())
		resourceSchemaURL := resourceSpan.GetSchemaUrl()
		serviceName := resourceAttributes["service.name"]
		deploymentEnvironment := resourceAttributes["deployment.environment"]

		for _, scopeSpan := range resourceSpan.GetScopeSpans() {
			scope := scopeSpan.GetScope()
			scopeName := scope.GetName()
			scopeVersion := scope.GetVersion()
			scopeAttributes := kvListToMap(scope.GetAttributes())
			scopeSchemaURL := scopeSpan.GetSchemaUrl()

			for _, span := range scopeSpan.GetSpans() {
				startTime := util.NanoToTime(span.GetStartTimeUnixNano())
				endTime := util.NanoToTime(span.GetEndTimeUnixNano())
				if startTime.IsZero() {
					startTime = time.Now().UTC()
				}
				if endTime.IsZero() {
					endTime = startTime
				}

				events := make([]models.SpanEvent, 0, len(span.GetEvents()))
				for _, event := range span.GetEvents() {
					events = append(events, models.SpanEvent{
						Name:       event.GetName(),
						Timestamp:  util.NanoToTime(event.GetTimeUnixNano()),
						Attributes: kvListToMap(event.GetAttributes()),
					})
				}

				links := make([]models.SpanLink, 0, len(span.GetLinks()))
				for _, link := range span.GetLinks() {
					links = append(links, models.SpanLink{
						TraceID:    hex.EncodeToString(link.GetTraceId()),
						SpanID:     hex.EncodeToString(link.GetSpanId()),
						TraceState: link.GetTraceState(),
						Attributes: kvListToMap(link.GetAttributes()),
					})
				}

				statusCode := uint8(0)
				statusMessage := ""
				if status := span.GetStatus(); status != nil {
					statusCode = uint8(status.GetCode())
					statusMessage = status.GetMessage()
				}

				spans = append(spans, models.Span{
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
					SpanAttributes:        kvListToMap(span.GetAttributes()),
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

func (service *service) transformMetrics(resourceMetrics []*metricspb.ResourceMetrics) []models.MetricPoint {
	var points []models.MetricPoint

	for _, resourceMetric := range resourceMetrics {
		resourceAttributes := kvListToMap(resourceMetric.GetResource().GetAttributes())
		serviceName := resourceAttributes["service.name"]
		deploymentEnvironment := resourceAttributes["deployment.environment"]

		for _, scopeMetric := range resourceMetric.GetScopeMetrics() {
			scope := scopeMetric.GetScope()
			scopeName := scope.GetName()
			scopeVersion := scope.GetVersion()

			for _, metric := range scopeMetric.GetMetrics() {
				name := metric.GetName()
				unit := metric.GetUnit()
				description := metric.GetDescription()

				switch data := metric.GetData().(type) {
				case *metricspb.Metric_Sum:
					points = append(points, transformSum(data.Sum, name, unit, description, serviceName, deploymentEnvironment, resourceAttributes, scopeName, scopeVersion)...)
				case *metricspb.Metric_Gauge:
					points = append(points, transformGauge(data.Gauge, name, unit, description, serviceName, deploymentEnvironment, resourceAttributes, scopeName, scopeVersion)...)
				case *metricspb.Metric_Histogram:
					points = append(points, transformHistogram(data.Histogram, name, unit, description, serviceName, deploymentEnvironment, resourceAttributes, scopeName, scopeVersion)...)
				}
			}
		}
	}

	return points
}

func transformSum(sum *metricspb.Sum, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []models.MetricPoint {
	var points []models.MetricPoint
	temporality := mapAggregationTemporality(sum.GetAggregationTemporality())

	for _, point := range sum.GetDataPoints() {
		output := models.MetricPoint{
			MetricName:             name,
			MetricType:             "sum",
			MetricUnit:             unit,
			Description:            description,
			ServiceName:            serviceName,
			DeploymentEnvironment:  deploymentEnvironment,
			ResourceAttributes:     resourceAttributes,
			ScopeName:              scopeName,
			ScopeVersion:           scopeVersion,
			Attributes:             kvListToMap(point.GetAttributes()),
			StartTime:              util.NanoToTime(point.GetStartTimeUnixNano()),
			Time:                   util.NanoToTime(point.GetTimeUnixNano()),
			AggregationTemporality: temporality,
			IsMonotonic:            sum.GetIsMonotonic(),
			Flags:                  point.GetFlags(),
			Exemplars:              transformExemplars(point.GetExemplars()),
		}

		switch value := point.GetValue().(type) {
		case *metricspb.NumberDataPoint_AsInt:
			output.ValueInt = &value.AsInt
		case *metricspb.NumberDataPoint_AsDouble:
			output.ValueDouble = &value.AsDouble
		}

		if output.Time.IsZero() {
			output.Time = time.Now().UTC()
		}

		points = append(points, output)
	}

	return points
}

func transformGauge(gauge *metricspb.Gauge, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []models.MetricPoint {
	var points []models.MetricPoint

	for _, point := range gauge.GetDataPoints() {
		output := models.MetricPoint{
			MetricName:            name,
			MetricType:            "gauge",
			MetricUnit:            unit,
			Description:           description,
			ServiceName:           serviceName,
			DeploymentEnvironment: deploymentEnvironment,
			ResourceAttributes:    resourceAttributes,
			ScopeName:             scopeName,
			ScopeVersion:          scopeVersion,
			Attributes:            kvListToMap(point.GetAttributes()),
			StartTime:             util.NanoToTime(point.GetStartTimeUnixNano()),
			Time:                  util.NanoToTime(point.GetTimeUnixNano()),
			Flags:                 point.GetFlags(),
			Exemplars:             transformExemplars(point.GetExemplars()),
		}

		switch value := point.GetValue().(type) {
		case *metricspb.NumberDataPoint_AsInt:
			output.ValueInt = &value.AsInt
		case *metricspb.NumberDataPoint_AsDouble:
			output.ValueDouble = &value.AsDouble
		}

		if output.Time.IsZero() {
			output.Time = time.Now().UTC()
		}

		points = append(points, output)
	}

	return points
}

func transformHistogram(histogram *metricspb.Histogram, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []models.MetricPoint {
	var points []models.MetricPoint
	temporality := mapAggregationTemporality(histogram.GetAggregationTemporality())

	for _, point := range histogram.GetDataPoints() {
		output := models.MetricPoint{
			MetricName:              name,
			MetricType:              "histogram",
			MetricUnit:              unit,
			Description:             description,
			ServiceName:             serviceName,
			DeploymentEnvironment:   deploymentEnvironment,
			ResourceAttributes:      resourceAttributes,
			ScopeName:               scopeName,
			ScopeVersion:            scopeVersion,
			Attributes:              kvListToMap(point.GetAttributes()),
			StartTime:               util.NanoToTime(point.GetStartTimeUnixNano()),
			Time:                    util.NanoToTime(point.GetTimeUnixNano()),
			AggregationTemporality:  temporality,
			HistogramCount:          uint64Ptr(point.GetCount()),
			HistogramSum:            float64Ptr(point.GetSum()),
			HistogramBucketCounts:   point.GetBucketCounts(),
			HistogramExplicitBounds: point.GetExplicitBounds(),
			Flags:                   point.GetFlags(),
			Exemplars:               transformExemplars(point.GetExemplars()),
		}

		if point.Min != nil {
			output.HistogramMin = point.Min
		}
		if point.Max != nil {
			output.HistogramMax = point.Max
		}
		if output.Time.IsZero() {
			output.Time = time.Now().UTC()
		}

		points = append(points, output)
	}

	return points
}

func transformExemplars(exemplars []*metricspb.Exemplar) []models.MetricExemplar {
	output := make([]models.MetricExemplar, 0, len(exemplars))

	for _, exemplar := range exemplars {
		value := 0.0
		switch current := exemplar.GetValue().(type) {
		case *metricspb.Exemplar_AsInt:
			value = float64(current.AsInt)
		case *metricspb.Exemplar_AsDouble:
			value = current.AsDouble
		}

		output = append(output, models.MetricExemplar{
			TraceID:   hex.EncodeToString(exemplar.GetTraceId()),
			SpanID:    hex.EncodeToString(exemplar.GetSpanId()),
			Value:     value,
			Timestamp: util.NanoToTime(exemplar.GetTimeUnixNano()),
		})
	}

	return output
}

func mapAggregationTemporality(temporality metricspb.AggregationTemporality) string {
	switch temporality {
	case metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_DELTA:
		return "delta"
	case metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_CUMULATIVE:
		return "cumulative"
	default:
		return "unspecified"
	}
}

func kvListToMap(attributes []*commonpb.KeyValue) map[string]string {
	values := make(map[string]string, len(attributes))
	for _, attribute := range attributes {
		values[attribute.GetKey()] = anyValueToString(attribute.GetValue())
	}
	return values
}

func anyValueToString(value *commonpb.AnyValue) string {
	if value == nil {
		return ""
	}

	switch current := value.Value.(type) {
	case *commonpb.AnyValue_StringValue:
		return current.StringValue
	case *commonpb.AnyValue_BoolValue:
		if current.BoolValue {
			return "true"
		}
		return "false"
	case *commonpb.AnyValue_IntValue:
		return strconv.FormatInt(current.IntValue, 10)
	case *commonpb.AnyValue_DoubleValue:
		return strconv.FormatFloat(current.DoubleValue, 'f', -1, 64)
	case *commonpb.AnyValue_BytesValue:
		return hex.EncodeToString(current.BytesValue)
	case *commonpb.AnyValue_ArrayValue:
		parts := make([]string, 0, len(current.ArrayValue.GetValues()))
		for _, item := range current.ArrayValue.GetValues() {
			parts = append(parts, anyValueToString(item))
		}
		return "[" + strings.Join(parts, ",") + "]"
	case *commonpb.AnyValue_KvlistValue:
		pairs := make([]string, 0, len(current.KvlistValue.GetValues()))
		for _, item := range current.KvlistValue.GetValues() {
			pairs = append(pairs, item.GetKey()+"="+anyValueToString(item.GetValue()))
		}
		return "{" + strings.Join(pairs, ",") + "}"
	default:
		return ""
	}
}

func uint64Ptr(value uint64) *uint64 {
	return &value
}

func float64Ptr(value float64) *float64 {
	if math.IsNaN(value) {
		return nil
	}
	return &value
}
