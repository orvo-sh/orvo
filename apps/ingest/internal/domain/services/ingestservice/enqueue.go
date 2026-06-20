package ingestservice

import (
	"context"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
)

func (service *service) enqueueHeartbeatCheckIn(ctx context.Context, checkIn models.HeartbeatCheckIn) error {
	return service.heartbeatCheckInsBatcher.Push(ctx, checkIn)
}

func (service *service) Close() {
	service.logsBatcher.Close()
	service.tracesBatcher.Close()
	service.metricsBatcher.Close()
	service.heartbeatCheckInsBatcher.Close()
}
