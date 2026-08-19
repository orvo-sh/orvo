package runtime

import (
	"context"
	"fmt"
	"log/slog"
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
)

type Config struct {
	PostgresURL          string
	ClickHouseURL        string
	Environment          string
	OTELEndpoint         string
	OTELIngestionKey     string
	HTTPHost             string
	HTTPPort             string
	FlushInterval        time.Duration
	LogsBatchSize        int
	TracesBatchSize      int
	MetricsBatchSize     int
	HeartbeatBatchSize   int
	MaxQueueSize         int
	ClickHouseHTTPBridge bool
}

func ConfigFromEnv() Config {
	return Config{
		PostgresURL:        env.MustString("POSTGRES_URL"),
		ClickHouseURL:      env.MustString("CLICKHOUSE_URL"),
		Environment:        env.GetString("ENVIRONMENT", "development"),
		OTELEndpoint:       env.GetString("OTEL_ENDPOINT", ""),
		OTELIngestionKey:   env.GetString("OTEL_INGESTION_KEY", ""),
		HTTPHost:           env.GetString("INGEST_HTTP_HOST", "0.0.0.0"),
		HTTPPort:           env.GetString("INGEST_HTTP_PORT", "4318"),
		FlushInterval:      env.GetDuration("INGEST_WORKER_FLUSH_INTERVAL", 5*time.Second),
		LogsBatchSize:      env.GetInt("INGEST_WORKER_LOGS_BATCH_SIZE", 1000),
		TracesBatchSize:    env.GetInt("INGEST_WORKER_TRACES_BATCH_SIZE", 1000),
		MetricsBatchSize:   env.GetInt("INGEST_WORKER_METRICS_BATCH_SIZE", 1000),
		HeartbeatBatchSize: env.GetInt("INGEST_WORKER_HEARTBEAT_BATCH_SIZE", 500),
		MaxQueueSize:       env.GetInt("INGEST_WORKER_MAX_QUEUE_SIZE", 10000),
	}
}

func Run(ctx context.Context, config Config) error {
	appLogger := logger.New(logger.Config{
		ServiceName: "orvo-ingest",
		Environment: config.Environment,
	})

	shutdownOTEL, err := appotel.Init(ctx, appotel.Config{
		ServiceName:  "orvo-ingest",
		Environment:  config.Environment,
		Endpoint:     config.OTELEndpoint,
		IngestionKey: config.OTELIngestionKey,
	})
	if err != nil {
		return fmt.Errorf("ingest runtime: initialize telemetry: %w", err)
	}
	defer shutdownOTEL(context.Background())

	postgresClient, err := postgres.New(ctx, config.PostgresURL)
	if err != nil {
		return fmt.Errorf("ingest runtime: initialize postgres: %w", err)
	}
	defer postgresClient.Close()

	var clickhouseClient *clickhouse.Client
	if config.ClickHouseHTTPBridge {
		clickhouseClient, err = clickhouse.NewHTTPBridge(ctx, config.ClickHouseURL)
	} else {
		clickhouseClient, err = clickhouse.New(ctx, config.ClickHouseURL)
	}
	if err != nil {
		return fmt.Errorf("ingest runtime: initialize clickhouse: %w", err)
	}
	defer clickhouseClient.Close()

	backgroundManager := background.New(appLogger)
	authService := authservice.New(postgresClient, appLogger, backgroundManager)
	billingService := billingservice.New(postgresClient, appLogger)
	ingestService := ingestservice.New(
		postgresClient,
		clickhouseClient,
		appLogger,
		billingService,
		ingestservice.Config{
			Logs:              ingestservice.IngestBatcherConfig{FlushInterval: config.FlushInterval, MaxQueueSize: config.MaxQueueSize, BatchSize: config.LogsBatchSize},
			Traces:            ingestservice.IngestBatcherConfig{FlushInterval: config.FlushInterval, MaxQueueSize: config.MaxQueueSize, BatchSize: config.TracesBatchSize},
			Metrics:           ingestservice.IngestBatcherConfig{FlushInterval: config.FlushInterval, MaxQueueSize: config.MaxQueueSize, BatchSize: config.MetricsBatchSize},
			HeartbeatCheckIns: ingestservice.IngestBatcherConfig{FlushInterval: config.FlushInterval, MaxQueueSize: config.MaxQueueSize, BatchSize: config.HeartbeatBatchSize},
		},
	)
	defer ingestService.Close()

	server, err := ingesthttp.New(authService, ingestService, appLogger, ingesthttp.Config{
		Host: config.HTTPHost,
		Port: config.HTTPPort,
	})
	if err != nil {
		return fmt.Errorf("ingest runtime: initialize HTTP server: %w", err)
	}

	server.Start()
	appLogger.Info("Run: ingest service started",
		slog.String("environment", config.Environment),
		slog.String("http_addr", config.HTTPHost+":"+config.HTTPPort),
	)

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		appLogger.Warn("Run: failed to shutdown HTTP server", slog.Any("error", err))
	}

	backgroundManager.Wait()
	return nil
}
