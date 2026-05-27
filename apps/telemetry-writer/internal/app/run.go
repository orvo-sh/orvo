package app

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/config"
	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/entitlements"
	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/observability"
	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/queue"
	chstorage "github.com/orvo-sh/orvo/apps/telemetry-writer/internal/storage/clickhouse"
	pgstorage "github.com/orvo-sh/orvo/apps/telemetry-writer/internal/storage/postgres"
	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/telemetry"
)

func Run(ctx context.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := observability.NewLogger(cfg.App.Environment)

	postgresDB, err := pgstorage.New(ctx, cfg.Postgres)
	if err != nil {
		return logAndError(logger, "main: failed to initialize postgres", err)
	}
	defer postgresDB.Close()

	clickhouseDB, err := chstorage.New(ctx, cfg.ClickHouse)
	if err != nil {
		return logAndError(logger, "main: failed to initialize clickhouse", err)
	}
	defer clickhouseDB.Close()

	natsClient, err := queue.New(ctx, logger, cfg.Nats)
	if err != nil {
		return logAndError(logger, "main: failed to initialize nats", err)
	}
	defer natsClient.Close()

	entitlementCache := entitlements.NewCache(
		postgresDB,
		logger,
		cfg.Writer.EntitlementsCacheTTL,
	)

	service := telemetry.NewService(logger, natsClient, clickhouseDB, entitlementCache, cfg.Writer)

	logger.Info("main: telemetry writer started",
		slog.String("service_name", config.ServiceName),
		slog.String("environment", cfg.App.Environment),
	)

	if err := service.Run(ctx); err != nil {
		return logAndError(logger, "main: telemetry writer stopped with error", err)
	}

	return nil
}

func logAndError(logger *slog.Logger, message string, err error) error {
	logger.Error(message, slog.Any("error", err))
	return err
}
