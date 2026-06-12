package ingest

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"time"

	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"log/slog"
)

func (service *TelemetryService) transformLogs(resourceLogs []*logspb.ResourceLogs) []LogRecord {
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

func (service *TelemetryService) transformTraces(resourceSpans []*tracepb.ResourceSpans) []Span {
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

func (service *TelemetryService) transformMetrics(resourceMetrics []*metricspb.ResourceMetrics) []MetricPoint {
	var points []MetricPoint

	for _, resourceMetric := range resourceMetrics {
		resourceAttributes := KvListToMap(resourceMetric.GetResource().GetAttributes())
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
					points = append(points, service.transformSum(data.Sum, name, unit, description, serviceName, deploymentEnvironment, resourceAttributes, scopeName, scopeVersion)...)
				case *metricspb.Metric_Gauge:
					points = append(points, service.transformGauge(data.Gauge, name, unit, description, serviceName, deploymentEnvironment, resourceAttributes, scopeName, scopeVersion)...)
				case *metricspb.Metric_Histogram:
					points = append(points, service.transformHistogram(data.Histogram, name, unit, description, serviceName, deploymentEnvironment, resourceAttributes, scopeName, scopeVersion)...)
				case *metricspb.Metric_ExponentialHistogram:
					points = append(points, service.transformExponentialHistogram(data.ExponentialHistogram, name, unit, description, serviceName, deploymentEnvironment, resourceAttributes, scopeName, scopeVersion)...)
				case *metricspb.Metric_Summary:
					service.logger.Debug("transformMetrics: skipping unsupported Summary metric", slog.String("metric_name", name))
				}
			}
		}
	}

	return points
}

func (service *TelemetryService) transformSum(sum *metricspb.Sum, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []MetricPoint {
	var points []MetricPoint
	temporality := mapAggregationTemporality(sum.GetAggregationTemporality())

	for _, point := range sum.GetDataPoints() {
		output := MetricPoint{
			MetricName:             name,
			MetricType:             MetricTypeSum.String(),
			MetricUnit:             unit,
			Description:            description,
			ServiceName:            serviceName,
			DeploymentEnvironment:  deploymentEnvironment,
			ResourceAttributes:     resourceAttributes,
			ScopeName:              scopeName,
			ScopeVersion:           scopeVersion,
			Attributes:             KvListToMap(point.GetAttributes()),
			StartTime:              NanoToTime(point.GetStartTimeUnixNano()),
			Time:                   NanoToTime(point.GetTimeUnixNano()),
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

func (service *TelemetryService) transformGauge(gauge *metricspb.Gauge, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []MetricPoint {
	var points []MetricPoint

	for _, point := range gauge.GetDataPoints() {
		output := MetricPoint{
			MetricName:            name,
			MetricType:            MetricTypeGauge.String(),
			MetricUnit:            unit,
			Description:           description,
			ServiceName:           serviceName,
			DeploymentEnvironment: deploymentEnvironment,
			ResourceAttributes:    resourceAttributes,
			ScopeName:             scopeName,
			ScopeVersion:          scopeVersion,
			Attributes:            KvListToMap(point.GetAttributes()),
			StartTime:             NanoToTime(point.GetStartTimeUnixNano()),
			Time:                  NanoToTime(point.GetTimeUnixNano()),
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

func (service *TelemetryService) transformHistogram(histogram *metricspb.Histogram, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []MetricPoint {
	var points []MetricPoint
	temporality := mapAggregationTemporality(histogram.GetAggregationTemporality())

	for _, point := range histogram.GetDataPoints() {
		count := point.GetCount()
		sum := point.GetSum()
		min := point.GetMin()
		max := point.GetMax()

		output := MetricPoint{
			MetricName:              name,
			MetricType:              MetricTypeHistogram.String(),
			MetricUnit:              unit,
			Description:             description,
			ServiceName:             serviceName,
			DeploymentEnvironment:   deploymentEnvironment,
			ResourceAttributes:      resourceAttributes,
			ScopeName:               scopeName,
			ScopeVersion:            scopeVersion,
			Attributes:              KvListToMap(point.GetAttributes()),
			StartTime:               NanoToTime(point.GetStartTimeUnixNano()),
			Time:                    NanoToTime(point.GetTimeUnixNano()),
			AggregationTemporality:  temporality,
			HistogramCount:          &count,
			HistogramSum:            &sum,
			HistogramMin:            &min,
			HistogramMax:            &max,
			HistogramBucketCounts:   point.GetBucketCounts(),
			HistogramExplicitBounds: point.GetExplicitBounds(),
			Flags:                   point.GetFlags(),
			Exemplars:               transformExemplars(point.GetExemplars()),
		}

		if output.Time.IsZero() {
			output.Time = time.Now().UTC()
		}

		points = append(points, output)
	}

	return points
}

func (service *TelemetryService) transformExponentialHistogram(histogram *metricspb.ExponentialHistogram, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []MetricPoint {
	var points []MetricPoint
	temporality := mapAggregationTemporality(histogram.GetAggregationTemporality())

	for _, point := range histogram.GetDataPoints() {
		count := point.GetCount()
		sum := point.GetSum()
		min := point.GetMin()
		max := point.GetMax()

		explicitBounds, bucketCounts := convertExponentialBuckets(int(point.GetScale()), point.GetPositive(), point.GetNegative(), point.GetZeroCount())
		output := MetricPoint{
			MetricName:              name,
			MetricType:              MetricTypeHistogram.String(),
			MetricUnit:              unit,
			Description:             description,
			ServiceName:             serviceName,
			DeploymentEnvironment:   deploymentEnvironment,
			ResourceAttributes:      resourceAttributes,
			ScopeName:               scopeName,
			ScopeVersion:            scopeVersion,
			Attributes:              KvListToMap(point.GetAttributes()),
			StartTime:               NanoToTime(point.GetStartTimeUnixNano()),
			Time:                    NanoToTime(point.GetTimeUnixNano()),
			AggregationTemporality:  temporality,
			HistogramCount:          &count,
			HistogramSum:            &sum,
			HistogramMin:            &min,
			HistogramMax:            &max,
			HistogramBucketCounts:   bucketCounts,
			HistogramExplicitBounds: explicitBounds,
			Flags:                   point.GetFlags(),
			Exemplars:               transformExemplars(point.GetExemplars()),
		}

		if output.Time.IsZero() {
			output.Time = time.Now().UTC()
		}

		points = append(points, output)
	}

	return points
}

func convertExponentialBuckets(scale int, positive *metricspb.ExponentialHistogramDataPoint_Buckets, negative *metricspb.ExponentialHistogramDataPoint_Buckets, zeroCount uint64) ([]float64, []uint64) {
	base := math.Pow(2, math.Pow(2, float64(-scale)))

	var bounds []float64
	var counts []uint64

	appendBuckets := func(direction float64, buckets *metricspb.ExponentialHistogramDataPoint_Buckets) {
		if buckets == nil {
			return
		}

		offset := buckets.GetOffset()
		for index, count := range buckets.GetBucketCounts() {
			boundary := math.Pow(base, float64(offset+int32(index)+1)) * direction
			bounds = append(bounds, boundary)
			counts = append(counts, count)
		}
	}

	appendBuckets(-1, negative)
	if zeroCount > 0 {
		bounds = append(bounds, 0)
		counts = append(counts, zeroCount)
	}
	appendBuckets(1, positive)

	return bounds, counts
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

func KvListToMap(kvs []*commonpb.KeyValue) map[string]string {
	if len(kvs) == 0 {
		return map[string]string{}
	}

	out := make(map[string]string, len(kvs))
	for _, kv := range kvs {
		out[kv.GetKey()] = AnyValueToString(kv.GetValue())
	}

	return out
}

func AnyValueToString(value *commonpb.AnyValue) string {
	if value == nil {
		return ""
	}

	switch typed := value.GetValue().(type) {
	case *commonpb.AnyValue_StringValue:
		return typed.StringValue
	case *commonpb.AnyValue_BoolValue:
		return fmt.Sprintf("%t", typed.BoolValue)
	case *commonpb.AnyValue_IntValue:
		return fmt.Sprintf("%d", typed.IntValue)
	case *commonpb.AnyValue_DoubleValue:
		return fmt.Sprintf("%g", typed.DoubleValue)
	case *commonpb.AnyValue_BytesValue:
		return hex.EncodeToString(typed.BytesValue)
	case *commonpb.AnyValue_ArrayValue, *commonpb.AnyValue_KvlistValue:
		bytes, err := json.Marshal(anyValueToInterface(value))
		if err != nil {
			return fmt.Sprintf("%v", value)
		}
		return string(bytes)
	default:
		return ""
	}
}

func anyValueToInterface(value *commonpb.AnyValue) any {
	if value == nil {
		return nil
	}

	switch typed := value.GetValue().(type) {
	case *commonpb.AnyValue_StringValue:
		return typed.StringValue
	case *commonpb.AnyValue_BoolValue:
		return typed.BoolValue
	case *commonpb.AnyValue_IntValue:
		return typed.IntValue
	case *commonpb.AnyValue_DoubleValue:
		return typed.DoubleValue
	case *commonpb.AnyValue_BytesValue:
		return hex.EncodeToString(typed.BytesValue)
	case *commonpb.AnyValue_ArrayValue:
		if typed.ArrayValue == nil {
			return nil
		}
		items := make([]any, len(typed.ArrayValue.GetValues()))
		for index, item := range typed.ArrayValue.GetValues() {
			items[index] = anyValueToInterface(item)
		}
		return items
	case *commonpb.AnyValue_KvlistValue:
		if typed.KvlistValue == nil {
			return nil
		}
		items := make(map[string]any, len(typed.KvlistValue.GetValues()))
		for _, kv := range typed.KvlistValue.GetValues() {
			items[kv.GetKey()] = anyValueToInterface(kv.GetValue())
		}
		return items
	default:
		return nil
	}
}
