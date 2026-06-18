package workers

import (
	"context"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
)

func (service *service) EnqueueLogs(ctx context.Context, message models.LogsMessage) error {
	return service.logsBatcher.Push(ctx, message)
}

func (service *service) EnqueueTraces(ctx context.Context, message models.TracesMessage) error {
	return service.tracesBatcher.Push(ctx, message)
}

func (service *service) EnqueueMetrics(ctx context.Context, message models.MetricsMessage) error {
	return service.metricsBatcher.Push(ctx, message)
}

func (service *service) EnqueueHeartbeatCheckIn(ctx context.Context, checkIn models.HeartbeatCheckIn) error {
	return service.heartbeatCheckInsBatcher.Push(ctx, checkIn)
}
