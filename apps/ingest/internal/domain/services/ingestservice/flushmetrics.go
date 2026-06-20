package ingestservice

import (
	"context"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	chdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/chutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) flushMetrics(ctx context.Context, batch []models.MetricsMessage) error {
	rows := make([]chdb.InsertMetricsRawParams, 0)

	for _, message := range batch {
		receivedAt := chutil.NormalizeTime(message.ReceivedAt, time.Now().UTC())
		for _, point := range message.Points {
			pointTime := chutil.NormalizeTime(point.Time, receivedAt)
			startTime := chutil.NormalizeTime(point.StartTime, pointTime)
			expiresAt := computeExpiresAt(pointTime, receivedAt, message.RetentionDays)
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

	return service.clickhouse.InsertMetricsRaw(ctx, rows)
}
