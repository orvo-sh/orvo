package ingestservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/workers"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

type billingService interface {
	ReserveSignalUsage(ctx context.Context, organizationID string, signal string, bytes int) (*billingservice.Reservation, apperr.Error)
	ReleaseSignalUsage(ctx context.Context, reservation *billingservice.Reservation) error
}

type Service interface {
	IngestLogs(ctx context.Context, input IngestLogsInput) apperr.Error
	IngestTraces(ctx context.Context, input IngestTracesInput) apperr.Error
	IngestMetrics(ctx context.Context, input IngestMetricsInput) apperr.Error
}

type service struct {
	workers  workers.Service
	billing  billingService
	postgres *postgres.Client
	logger   *slog.Logger
}

func New(workers workers.Service, billing billingService, postgres *postgres.Client, logger *slog.Logger) Service {
	return &service{
		workers:  workers,
		billing:  billing,
		postgres: postgres,
		logger:   logger,
	}
}

type IngestLogsInput struct {
	ResolvedIngestionKey models.ResolvedIngestionKey
	Meta                 models.MessageMeta
	AcceptedBytes        int
	ResourceLogs         []*logspb.ResourceLogs
}

type IngestTracesInput struct {
	ResolvedIngestionKey models.ResolvedIngestionKey
	Meta                 models.MessageMeta
	AcceptedBytes        int
	ResourceSpans        []*tracepb.ResourceSpans
}

type IngestMetricsInput struct {
	ResolvedIngestionKey models.ResolvedIngestionKey
	Meta                 models.MessageMeta
	AcceptedBytes        int
	ResourceMetrics      []*metricspb.ResourceMetrics
}
