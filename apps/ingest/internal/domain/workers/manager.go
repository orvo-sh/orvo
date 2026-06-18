package workers

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/entitlementservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/batcher"
)

type Service interface {
	EnqueueLogs(ctx context.Context, message models.LogsMessage) error
	EnqueueTraces(ctx context.Context, message models.TracesMessage) error
	EnqueueMetrics(ctx context.Context, message models.MetricsMessage) error
	EnqueueHeartbeatCheckIn(ctx context.Context, checkIn models.HeartbeatCheckIn) error
	Close()
}

type Config struct {
	FlushInterval              time.Duration
	FlushTimeout               time.Duration
	LogsBatchSize              int
	TracesBatchSize            int
	MetricsBatchSize           int
	HeartbeatCheckInsBatchSize int
	MaxQueueSize               int

	DefaultLogsRetentionDays    int
	DefaultTracesRetentionDays  int
	DefaultMetricsRetentionDays int
}

type service struct {
	logger       *slog.Logger
	clickhouse   *clickhouse.Client
	entitlements entitlementservice.Service
	config       Config

	logsBatcher              *batcher.Batcher[models.LogsMessage]
	tracesBatcher            *batcher.Batcher[models.TracesMessage]
	metricsBatcher           *batcher.Batcher[models.MetricsMessage]
	heartbeatCheckInsBatcher *batcher.Batcher[models.HeartbeatCheckIn]
}

func New(
	logger *slog.Logger,
	clickhouse *clickhouse.Client,
	entitlements entitlementservice.Service,
	config Config,
) Service {
	worker := &service{
		logger:       logger,
		clickhouse:   clickhouse,
		entitlements: entitlements,
		config:       config,
	}

	worker.logsBatcher = batcher.New(
		logger.With("worker", "logs"),
		worker.flushLogs,
		batcher.WithBatchSize(config.LogsBatchSize),
		batcher.WithFlushInterval(config.FlushInterval),
		batcher.WithWriteTimeout(config.FlushTimeout),
		batcher.WithMaxQueueSize(config.MaxQueueSize),
	)
	worker.tracesBatcher = batcher.New(
		logger.With("worker", "traces"),
		worker.flushTraces,
		batcher.WithBatchSize(config.TracesBatchSize),
		batcher.WithFlushInterval(config.FlushInterval),
		batcher.WithWriteTimeout(config.FlushTimeout),
		batcher.WithMaxQueueSize(config.MaxQueueSize),
	)
	worker.metricsBatcher = batcher.New(
		logger.With("worker", "metrics"),
		worker.flushMetrics,
		batcher.WithBatchSize(config.MetricsBatchSize),
		batcher.WithFlushInterval(config.FlushInterval),
		batcher.WithWriteTimeout(config.FlushTimeout),
		batcher.WithMaxQueueSize(config.MaxQueueSize),
	)
	worker.heartbeatCheckInsBatcher = batcher.New(
		logger.With("worker", "heartbeat-checkins"),
		worker.flushHeartbeatCheckIns,
		batcher.WithBatchSize(config.HeartbeatCheckInsBatchSize),
		batcher.WithFlushInterval(config.FlushInterval),
		batcher.WithWriteTimeout(config.FlushTimeout),
		batcher.WithMaxQueueSize(config.MaxQueueSize),
	)

	return worker
}

func (service *service) Close() {
	service.logsBatcher.Close()
	service.tracesBatcher.Close()
	service.metricsBatcher.Close()
	service.heartbeatCheckInsBatcher.Close()
}
