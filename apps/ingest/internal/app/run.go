package app

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/auth"
	"github.com/orvo-sh/orvo/apps/ingest/internal/background"
	"github.com/orvo-sh/orvo/apps/ingest/internal/config"
	"github.com/orvo-sh/orvo/apps/ingest/internal/httpapi"
	"github.com/orvo-sh/orvo/apps/ingest/internal/observability"
	"github.com/orvo-sh/orvo/apps/ingest/internal/queue"
	"github.com/orvo-sh/orvo/apps/ingest/internal/storage/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/internal/telemetry"
)

func Run(ctx context.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := observability.NewLogger(observability.LoggerConfig{
		ServiceName: config.ServiceName,
		Environment: cfg.App.Environment,
	})

	shutdownOtel, err := observability.SetupOTel(ctx, cfg.App, cfg.Otel)
	if err != nil {
		logger.Error("main: failed to initialize OpenTelemetry", slog.Any("error", err))
		return err
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if shutdownErr := shutdownOtel(shutdownCtx); shutdownErr != nil {
			logger.Warn("main: failed to shutdown OpenTelemetry", slog.Any("error", shutdownErr))
		}
	}()

	postgresDB, err := postgres.New(ctx, cfg.Postgres)
	if err != nil {
		logger.Error("main: failed to initialize postgres", slog.Any("error", err))
		return err
	}
	defer postgresDB.Close()

	natsClient, err := queue.New(ctx, logger, cfg.Nats)
	if err != nil {
		logger.Error("main: failed to initialize nats", slog.Any("error", err))
		return err
	}
	defer natsClient.Close()

	backgroundManager := background.New(logger, background.Config{
		DefaultTimeout: config.DefaultBackgroundTimeout,
	})

	authService := auth.New(postgresDB, logger, backgroundManager, cfg.Ingest.IngestionKeyCacheTTL)
	ingestService := telemetry.NewService(natsClient, logger)

	server, err := httpapi.New(authService, ingestService, logger, cfg.Ingest)
	if err != nil {
		logger.Error("main: failed to initialize ingest server", slog.Any("error", err))
		return err
	}

	server.Start()

	logger.Info("main: ingest service started",
		slog.String("service_name", config.ServiceName),
		slog.String("environment", cfg.App.Environment),
	)

	<-ctx.Done()

	logger.Info("main: shutting down ingest service")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), config.DefaultShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Warn("main: failed to shutdown ingest server", slog.Any("error", err))
	}

	backgroundManager.Wait()
	return nil
}
