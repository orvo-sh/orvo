package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/authservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	ingesthttp "github.com/orvo-sh/orvo/apps/ingest/internal/http"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/internal/logger"
	appotel "github.com/orvo-sh/orvo/apps/ingest/internal/otel"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/background"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/env"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	postgresURL := env.MustString("POSTGRES_URL")
	clickhouseURL := env.MustString("CLICKHOUSE_URL")
	environment := env.GetString("ENVIRONMENT", "development")
	otelEndpoint := env.GetString("OTEL_ENDPOINT", "")
	otelIngestionKey := env.GetString("OTEL_INGESTION_KEY", "")
	httpPort := env.GetString("INGEST_HTTP_PORT", "4318")
	flushInterval := env.GetDuration("INGEST_WORKER_FLUSH_INTERVAL", 5*time.Second)
	logsBatchSize := env.GetInt("INGEST_WORKER_LOGS_BATCH_SIZE", 1000)
	tracesBatchSize := env.GetInt("INGEST_WORKER_TRACES_BATCH_SIZE", 1000)
	metricsBatchSize := env.GetInt("INGEST_WORKER_METRICS_BATCH_SIZE", 1000)
	heartbeatBatchSize := env.GetInt("INGEST_WORKER_HEARTBEAT_BATCH_SIZE", 500)
	maxQueueSize := env.GetInt("INGEST_WORKER_MAX_QUEUE_SIZE", 10000)

	appLogger := logger.New(logger.Config{
		ServiceName: "orvo-ingest",
		Environment: environment,
	})

	shutdown := util.Must(appotel.Init(ctx, appotel.Config{
		ServiceName:  "orvo-ingest",
		Environment:  environment,
		Endpoint:     otelEndpoint,
		IngestionKey: otelIngestionKey,
	}))
	defer shutdown(ctx)

	postgres := util.Must(postgres.New(ctx, postgresURL))
	defer postgres.Close()

	clickhouse := util.Must(clickhouse.New(ctx, clickhouseURL))
	defer clickhouse.Close()

	backgroundManager := background.New(appLogger)
	authService := authservice.New(postgres, appLogger, backgroundManager)
	billingService := billingservice.New(
		postgres,
		appLogger,
	)
	ingestService := ingestservice.New(
		postgres,
		clickhouse,
		appLogger,
		billingService,
		ingestservice.Config{
			Logs: ingestservice.IngestBatcherConfig{
				FlushInterval: flushInterval,
				MaxQueueSize:  maxQueueSize,
				BatchSize:     logsBatchSize,
			},
			Traces: ingestservice.IngestBatcherConfig{
				FlushInterval: flushInterval,
				MaxQueueSize:  maxQueueSize,
				BatchSize:     tracesBatchSize,
			},
			Metrics: ingestservice.IngestBatcherConfig{
				FlushInterval: flushInterval,
				MaxQueueSize:  maxQueueSize,
				BatchSize:     metricsBatchSize,
			},
			HeartbeatCheckIns: ingestservice.IngestBatcherConfig{
				FlushInterval: flushInterval,
				MaxQueueSize:  maxQueueSize,
				BatchSize:     heartbeatBatchSize,
			},
		},
	)
	defer ingestService.Close()

	server, err := ingesthttp.New(
		authService,
		ingestService,
		appLogger,
		ingesthttp.Config{
			Port: httpPort,
		},
	)
	if err != nil {
		appLogger.Error("main: failed to initialize http server", slog.Any("error", err))
		os.Exit(1)
	}

	server.Start()
	appLogger.Info("main: ingest service started",
		slog.String("environment", environment),
		slog.String("http_addr", "0.0.0.0:"+httpPort),
	)

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		appLogger.Warn("main: failed to shutdown http server", slog.Any("error", err))
	}

	backgroundManager.Wait()
}
