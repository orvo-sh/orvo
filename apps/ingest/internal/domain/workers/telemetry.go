package workers

import (
	"context"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	chdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/chutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) flushLogs(ctx context.Context, batch []models.LogsMessage) error {
	rows := make([]chdb.InsertLogsRawParams, 0)

	for _, message := range batch {
		policy, err := service.entitlements.Get(ctx, message.AppID)
		if err != nil {
			return err
		}

		receivedAt := chutil.NormalizeTime(message.ReceivedAt, time.Now().UTC())
		for _, record := range message.Records {
			timestamp := chutil.NormalizeTime(record.Timestamp, receivedAt)
			observedAt := chutil.NormalizeTime(record.ObservedTimestamp, timestamp)
			expiresAt := computeExpiresAt("logs", timestamp, policy, service.config.DefaultLogsRetentionDays)
			if !expiresAt.After(receivedAt) {
				continue
			}

			rows = append(rows, chdb.InsertLogsRawParams{
				ID:                    util.GenerateID("log"),
				AppID:                 message.AppID,
				IngestionKeyID:        message.IngestionKeyID,
				ReceivedAt:            receivedAt,
				ExpiresAt:             expiresAt,
				Timestamp:             timestamp,
				ObservedTimestamp:     observedAt,
				SeverityNumber:        record.SeverityNumber,
				SeverityText:          record.SeverityText,
				Body:                  record.Body,
				TraceID:               record.TraceID,
				SpanID:                record.SpanID,
				TraceFlags:            record.TraceFlags,
				ResourceAttributes:    chutil.NormalizeStringMap(record.ResourceAttributes),
				ResourceSchemaURL:     record.ResourceSchemaURL,
				ScopeName:             record.ScopeName,
				ScopeVersion:          record.ScopeVersion,
				ScopeAttributes:       chutil.NormalizeStringMap(record.ScopeAttributes),
				ScopeSchemaURL:        record.ScopeSchemaURL,
				LogAttributes:         chutil.NormalizeStringMap(record.LogAttributes),
				ServiceName:           record.ServiceName,
				DeploymentEnvironment: record.DeploymentEnvironment,
			})
		}
	}

	return service.clickhouse.Queries().InsertLogsRaw(ctx, rows)
}

func (service *service) flushTraces(ctx context.Context, batch []models.TracesMessage) error {
	rows := make([]chdb.InsertTracesRawParams, 0)

	for _, message := range batch {
		policy, err := service.entitlements.Get(ctx, message.AppID)
		if err != nil {
			return err
		}

		receivedAt := chutil.NormalizeTime(message.ReceivedAt, time.Now().UTC())
		for _, span := range message.Spans {
			startTime := chutil.NormalizeTime(span.StartTime, receivedAt)
			endTime := chutil.NormalizeTime(span.EndTime, startTime)
			expiresAt := computeExpiresAt("traces", startTime, policy, service.config.DefaultTracesRetentionDays)
			if !expiresAt.After(receivedAt) {
				continue
			}

			rows = append(rows, chdb.InsertTracesRawParams{
				ID:                    util.GenerateID("trc"),
				AppID:                 message.AppID,
				IngestionKeyID:        message.IngestionKeyID,
				ReceivedAt:            receivedAt,
				ExpiresAt:             expiresAt,
				TraceID:               span.TraceID,
				SpanID:                span.SpanID,
				ParentSpanID:          span.ParentSpanID,
				TraceState:            span.TraceState,
				Name:                  span.Name,
				Kind:                  span.Kind,
				StartTime:             startTime,
				EndTime:               endTime,
				DurationNs:            span.DurationNs,
				StatusCode:            span.StatusCode,
				StatusMessage:         span.StatusMessage,
				ResourceAttributes:    chutil.NormalizeStringMap(span.ResourceAttributes),
				ScopeAttributes:       chutil.NormalizeStringMap(span.ScopeAttributes),
				SpanAttributes:        chutil.NormalizeStringMap(span.SpanAttributes),
				ResourceSchemaURL:     span.ResourceSchemaURL,
				ScopeName:             span.ScopeName,
				ScopeVersion:          span.ScopeVersion,
				ScopeSchemaURL:        span.ScopeSchemaURL,
				EventsJSON:            chutil.MarshalJSON(span.Events, "[]"),
				LinksJSON:             chutil.MarshalJSON(span.Links, "[]"),
				ServiceName:           span.ServiceName,
				DeploymentEnvironment: span.DeploymentEnvironment,
			})
		}
	}

	return service.clickhouse.Queries().InsertTracesRaw(ctx, rows)
}

func (service *service) flushMetrics(ctx context.Context, batch []models.MetricsMessage) error {
	rows := make([]chdb.InsertMetricsRawParams, 0)

	for _, message := range batch {
		policy, err := service.entitlements.Get(ctx, message.AppID)
		if err != nil {
			return err
		}

		receivedAt := chutil.NormalizeTime(message.ReceivedAt, time.Now().UTC())
		for _, point := range message.Points {
			pointTime := chutil.NormalizeTime(point.Time, receivedAt)
			startTime := chutil.NormalizeTime(point.StartTime, pointTime)
			expiresAt := computeExpiresAt("metrics", pointTime, policy, service.config.DefaultMetricsRetentionDays)
			if !expiresAt.After(receivedAt) {
				continue
			}

			identity := resolveMetricIdentity(point)

			rows = append(rows, chdb.InsertMetricsRawParams{
				ID:                      util.GenerateID("met"),
				AppID:                   message.AppID,
				IngestionKeyID:          message.IngestionKeyID,
				ReceivedAt:              receivedAt,
				ExpiresAt:               expiresAt,
				EntityKind:              identity.EntityKind,
				HostID:                  identity.HostID,
				HostName:                identity.HostName,
				HostArch:                identity.HostArch,
				OSType:                  identity.OSType,
				ContainerID:             identity.ContainerID,
				ContainerName:           identity.ContainerName,
				ContainerImageName:      identity.ContainerImageName,
				MetricName:              point.MetricName,
				MetricType:              point.MetricType,
				MetricUnit:              point.MetricUnit,
				Description:             point.Description,
				ServiceName:             point.ServiceName,
				DeploymentEnvironment:   point.DeploymentEnvironment,
				ResourceAttributes:      chutil.NormalizeStringMap(point.ResourceAttributes),
				ScopeName:               point.ScopeName,
				ScopeVersion:            point.ScopeVersion,
				Attributes:              chutil.NormalizeStringMap(point.Attributes),
				StartTime:               startTime,
				Time:                    pointTime,
				ValueInt:                point.ValueInt,
				ValueDouble:             point.ValueDouble,
				AggregationTemporality:  point.AggregationTemporality,
				IsMonotonic:             point.IsMonotonic,
				HistogramCount:          point.HistogramCount,
				HistogramSum:            point.HistogramSum,
				HistogramMin:            point.HistogramMin,
				HistogramMax:            point.HistogramMax,
				HistogramBucketCounts:   point.HistogramBucketCounts,
				HistogramExplicitBounds: point.HistogramExplicitBounds,
				ExemplarsJSON:           chutil.MarshalJSON(point.Exemplars, "[]"),
				Flags:                   point.Flags,
			})
		}
	}

	return service.clickhouse.Queries().InsertMetricsRaw(ctx, rows)
}
