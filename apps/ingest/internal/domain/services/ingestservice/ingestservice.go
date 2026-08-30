package ingestservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/batcher"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

type IngestBatcherConfig struct {
	FlushInterval time.Duration
	MaxQueueSize  int
	BatchSize     int
}

type Config struct {
	Logs              IngestBatcherConfig
	Traces            IngestBatcherConfig
	Metrics           IngestBatcherConfig
	HeartbeatCheckIns IngestBatcherConfig
	AppBaseURL        string
	IngestBaseURL     string
}

type Service interface {
	IngestLogs(ctx context.Context, input IngestLogsInput) apperr.Error
	IngestTraces(ctx context.Context, input IngestTracesInput) apperr.Error
	IngestMetrics(ctx context.Context, input IngestMetricsInput) apperr.Error
	IngestHeartbeatCheckIn(ctx context.Context, token string) (time.Time, apperr.Error)
	Close()
}

type service struct {
	postgres   *postgres.Client
	clickhouse *clickhouse.Client
	logger     *slog.Logger

	logsBatcher              *batcher.Batcher[models.LogsMessage]
	tracesBatcher            *batcher.Batcher[models.TracesMessage]
	metricsBatcher           *batcher.Batcher[models.MetricsMessage]
	heartbeatCheckInsBatcher *batcher.Batcher[models.HeartbeatCheckIn]

	billingService billingservice.Service
	config         Config
}

func New(postgres *postgres.Client, clickhouse *clickhouse.Client, logger *slog.Logger, billingService billingservice.Service, config Config) Service {
	svc := &service{
		logger:         logger.With("service", "ingest"),
		postgres:       postgres,
		clickhouse:     clickhouse,
		billingService: billingService,
		config:         config,
	}

	svc.logsBatcher = batcher.New(
		logger.With("batcher", "logs"),
		svc.flushLogs,
		batcher.WithBatchSize(config.Logs.BatchSize),
		batcher.WithFlushInterval(config.Logs.FlushInterval),
		batcher.WithMaxQueueSize(config.Logs.MaxQueueSize),
	)
	svc.tracesBatcher = batcher.New(
		logger.With("batcher", "traces"),
		svc.flushTraces,
		batcher.WithBatchSize(config.Traces.BatchSize),
		batcher.WithFlushInterval(config.Traces.FlushInterval),
		batcher.WithMaxQueueSize(config.Traces.MaxQueueSize),
	)
	svc.metricsBatcher = batcher.New(
		logger.With("batcher", "metrics"),
		svc.flushMetrics,
		batcher.WithBatchSize(config.Metrics.BatchSize),
		batcher.WithFlushInterval(config.Metrics.FlushInterval),
		batcher.WithMaxQueueSize(config.Metrics.MaxQueueSize),
	)
	svc.heartbeatCheckInsBatcher = batcher.New(
		logger.With("batcher", "heartbeat-checkins"),
		svc.flushHeartbeatCheckIns,
		batcher.WithBatchSize(config.HeartbeatCheckIns.BatchSize),
		batcher.WithFlushInterval(config.HeartbeatCheckIns.FlushInterval),
		batcher.WithMaxQueueSize(config.HeartbeatCheckIns.MaxQueueSize),
	)

	return svc
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
