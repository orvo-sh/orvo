package ingest

import (
	"math"
	"time"

	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	"log/slog"
)

func (service *IngestService) transformMetrics(resourceMetrics []*metricspb.ResourceMetrics) []MetricPoint {
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

func (service *IngestService) transformSum(sum *metricspb.Sum, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []MetricPoint {
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

func (service *IngestService) transformGauge(gauge *metricspb.Gauge, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []MetricPoint {
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

func (service *IngestService) transformHistogram(histogram *metricspb.Histogram, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []MetricPoint {
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

func (service *IngestService) transformExponentialHistogram(histogram *metricspb.ExponentialHistogram, name string, unit string, description string, serviceName string, deploymentEnvironment string, resourceAttributes map[string]string, scopeName string, scopeVersion string) []MetricPoint {
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
