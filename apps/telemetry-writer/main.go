package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	writer "github.com/orvo-sh/orvo/apps/telemetry-writer/internal"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := writer.LoadConfig()
	if err != nil {
		panic(err)
	}

	logger := writer.NewLogger(cfg.App)

	postgresDB, err := writer.NewPostgres(ctx, cfg.Postgres)
	if err != nil {
		logger.Error("main: failed to initialize postgres", slog.Any("error", err))
		os.Exit(1)
	}
	defer postgresDB.Close()

	clickhouseDB, err := writer.NewClickHouse(ctx, cfg.ClickHouse)
	if err != nil {
		logger.Error("main: failed to initialize clickhouse", slog.Any("error", err))
		os.Exit(1)
	}
	defer clickhouseDB.Close()

	natsClient, err := writer.NewNATSClient(ctx, logger, cfg.Nats)
	if err != nil {
		logger.Error("main: failed to initialize nats", slog.Any("error", err))
		os.Exit(1)
	}
	defer natsClient.Close()

	entitlements := writer.NewEntitlementsCache(
		postgresDB,
		logger,
		cfg.Writer.EntitlementsCacheTTL,
	)

	service := writer.NewService(logger, natsClient, clickhouseDB, entitlements, cfg.Writer)

	logger.Info("main: telemetry writer started",
		slog.String("service_name", writer.ServiceName),
		slog.String("environment", cfg.App.Environment),
	)

	if err := service.Run(ctx); err != nil {
		logger.Error("main: telemetry writer stopped with error", slog.Any("error", err))
		os.Exit(1)
	}
}
