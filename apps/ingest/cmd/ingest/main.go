package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/authservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/deploymentservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/entitlementservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/heartbeatservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/workers"
	"github.com/orvo-sh/orvo/apps/ingest/internal/http"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/internal/logger"
	appotel "github.com/orvo-sh/orvo/apps/ingest/internal/otel"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/background"
)

const serviceName = "orvo-ingest"

type runtimeConfig struct {
	environment string

	postgresURL   string
	clickhouseURL string

	otelEndpoint     string
	otelIngestionKey string

	httpHost     string
	httpPort     string
	maxBodyBytes int64
	readTimeout  time.Duration
	writeTimeout time.Duration
	idleTimeout  time.Duration

	shutdownTimeout         time.Duration
	backgroundTimeout       time.Duration
	ingestionKeyCacheTTL    time.Duration
	entitlementCacheTTL     time.Duration
	flushInterval           time.Duration
	flushTimeout            time.Duration
	logsBatchSize           int
	tracesBatchSize         int
	metricsBatchSize        int
	heartbeatBatchSize      int
	maxQueueSize            int
	defaultLogsRetention    int
	defaultTracesRetention  int
	defaultMetricsRetention int
}

func main() {
	rootCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	config, err := loadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	appLogger := logger.New(logger.Config{
		ServiceName: serviceName,
		Environment: config.environment,
	})

	shutdownOTel, err := appotel.Init(rootCtx, appotel.Config{
		ServiceName:  serviceName,
		Environment:  config.environment,
		Endpoint:     config.otelEndpoint,
		IngestionKey: config.otelIngestionKey,
	})
	if err != nil {
		appLogger.Error("main: failed to initialize OpenTelemetry", slog.Any("error", err))
		os.Exit(1)
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := shutdownOTel(shutdownCtx); err != nil {
			appLogger.Warn("main: failed to shutdown OpenTelemetry", slog.Any("error", err))
		}
	}()

	postgresClient, err := postgres.New(rootCtx, config.postgresURL)
	if err != nil {
		appLogger.Error("main: failed to initialize postgres", slog.Any("error", err))
		os.Exit(1)
	}
	defer postgresClient.Close()

	clickhouseClient, err := clickhouse.New(rootCtx, config.clickhouseURL)
	if err != nil {
		appLogger.Error("main: failed to initialize clickhouse", slog.Any("error", err))
		os.Exit(1)
	}
	defer func() {
		if err := clickhouseClient.Close(); err != nil {
			appLogger.Warn("main: failed to close clickhouse", slog.Any("error", err))
		}
	}()

	backgroundManager := background.New(appLogger, background.Config{
		DefaultTimeout: config.backgroundTimeout,
	})

	entitlements := entitlementservice.New(
		postgresClient,
		appLogger,
		config.entitlementCacheTTL,
		config.defaultLogsRetention,
		config.defaultTracesRetention,
		config.defaultMetricsRetention,
	)
	workerService := workers.New(appLogger, clickhouseClient, entitlements, workers.Config{
		FlushInterval:               config.flushInterval,
		FlushTimeout:                config.flushTimeout,
		LogsBatchSize:               config.logsBatchSize,
		TracesBatchSize:             config.tracesBatchSize,
		MetricsBatchSize:            config.metricsBatchSize,
		HeartbeatCheckInsBatchSize:  config.heartbeatBatchSize,
		MaxQueueSize:                config.maxQueueSize,
		DefaultLogsRetentionDays:    config.defaultLogsRetention,
		DefaultTracesRetentionDays:  config.defaultTracesRetention,
		DefaultMetricsRetentionDays: config.defaultMetricsRetention,
	})
	defer workerService.Close()

	authService := authservice.New(postgresClient, appLogger, backgroundManager, config.ingestionKeyCacheTTL)
	billingService := billingservice.New(
		postgresClient,
		appLogger,
		config.defaultLogsRetention,
		config.defaultTracesRetention,
		config.defaultMetricsRetention,
	)
	deploymentService := deploymentservice.New(postgresClient, appLogger)
	heartbeatService := heartbeatservice.New(postgresClient, workerService, appLogger)
	ingestService := ingestservice.New(workerService, billingService, postgresClient, appLogger)

	server, err := ingesthttp.New(
		authService,
		ingestService,
		deploymentService,
		heartbeatService,
		appLogger,
		ingesthttp.Config{
			HTTPHost:     config.httpHost,
			HTTPPort:     config.httpPort,
			MaxBodyBytes: config.maxBodyBytes,
			ReadTimeout:  config.readTimeout,
			WriteTimeout: config.writeTimeout,
			IdleTimeout:  config.idleTimeout,
		},
	)
	if err != nil {
		appLogger.Error("main: failed to initialize http server", slog.Any("error", err))
		os.Exit(1)
	}

	server.Start()
	appLogger.Info("main: ingest service started",
		slog.String("service", serviceName),
		slog.String("environment", config.environment),
		slog.String("http_addr", config.httpHost+":"+config.httpPort),
	)

	<-rootCtx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), config.shutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		appLogger.Warn("main: failed to shutdown http server", slog.Any("error", err))
	}

	backgroundManager.Wait()
}

func loadConfig() (runtimeConfig, error) {
	environment := envOrDefault("APP_ENVIRONMENT", "development")
	if environment == "" {
		environment = envOrDefault("ENVIRONMENT", "development")
	}

	postgresURL, err := requiredEnv("POSTGRES_URL")
	if err != nil {
		return runtimeConfig{}, err
	}
	clickhouseURL, err := requiredEnv("CLICKHOUSE_URL")
	if err != nil {
		return runtimeConfig{}, err
	}

	return runtimeConfig{
		environment:             environment,
		postgresURL:             postgresURL,
		clickhouseURL:           clickhouseURL,
		otelEndpoint:            os.Getenv("OTEL_ENDPOINT"),
		otelIngestionKey:        os.Getenv("OTEL_INGESTION_KEY"),
		httpHost:                envOrDefault("INGEST_HTTP_HOST", "0.0.0.0"),
		httpPort:                envOrDefault("INGEST_HTTP_PORT", "4318"),
		maxBodyBytes:            envInt64("INGEST_MAX_BODY_BYTES", 10*1024*1024),
		readTimeout:             envDuration("INGEST_READ_TIMEOUT", 15*time.Second),
		writeTimeout:            envDuration("INGEST_WRITE_TIMEOUT", 15*time.Second),
		idleTimeout:             envDuration("INGEST_IDLE_TIMEOUT", 60*time.Second),
		shutdownTimeout:         envDuration("INGEST_SHUTDOWN_TIMEOUT", 15*time.Second),
		backgroundTimeout:       envDuration("INGEST_BACKGROUND_TIMEOUT", 30*time.Second),
		ingestionKeyCacheTTL:    envDuration("INGEST_INGESTION_KEY_CACHE_TTL", 5*time.Minute),
		entitlementCacheTTL:     envDuration("INGEST_ENTITLEMENT_CACHE_TTL", time.Minute),
		flushInterval:           envDuration("INGEST_WORKER_FLUSH_INTERVAL", 5*time.Second),
		flushTimeout:            envDuration("INGEST_WORKER_FLUSH_TIMEOUT", 10*time.Second),
		logsBatchSize:           envInt("INGEST_WORKER_LOGS_BATCH_SIZE", 1000),
		tracesBatchSize:         envInt("INGEST_WORKER_TRACES_BATCH_SIZE", 1000),
		metricsBatchSize:        envInt("INGEST_WORKER_METRICS_BATCH_SIZE", 1000),
		heartbeatBatchSize:      envInt("INGEST_WORKER_HEARTBEAT_BATCH_SIZE", 500),
		maxQueueSize:            envInt("INGEST_WORKER_MAX_QUEUE_SIZE", 10000),
		defaultLogsRetention:    envInt("INGEST_DEFAULT_LOGS_RETENTION_DAYS", 30),
		defaultTracesRetention:  envInt("INGEST_DEFAULT_TRACES_RETENTION_DAYS", 30),
		defaultMetricsRetention: envInt("INGEST_DEFAULT_METRICS_RETENTION_DAYS", 30),
	}, nil
}

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if strings.TrimSpace(value) == "" {
		return "", fmt.Errorf("missing required environment variable %s", key)
	}

	return value, nil
}

func envOrDefault(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	duration, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}

	return duration
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func envInt64(key string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}

	return parsed
}
