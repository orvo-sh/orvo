package ingest

import (
	"context"
	"log/slog"
	"time"
)

func Run(ctx context.Context) error {
	cfg, err := LoadConfig()
	if err != nil {
		return err
	}

	logger := NewLogger(LoggerConfig{
		ServiceName: ServiceName,
		Environment: cfg.App.Environment,
	})

	shutdownOtel, err := SetupOTel(ctx, cfg.App, cfg.Otel)
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

	postgresDB, err := NewPostgresClient(ctx, cfg.Postgres)
	if err != nil {
		logger.Error("main: failed to initialize postgres", slog.Any("error", err))
		return err
	}
	defer postgresDB.Close()

	natsClient, err := NewQueueClient(ctx, logger, cfg.Nats)
	if err != nil {
		logger.Error("main: failed to initialize nats", slog.Any("error", err))
		return err
	}
	defer natsClient.Close()

	backgroundManager := NewBackgroundManager(logger, BackgroundConfig{
		DefaultTimeout: DefaultBackgroundTimeout,
	})

	authService := NewAuthService(postgresDB, logger, backgroundManager, cfg.Ingest.IngestionKeyCacheTTL)
	billingService := NewBillingService(postgresDB, logger)
	ingestService := NewTelemetryService(natsClient, billingService, postgresDB, logger)
	deploymentService := NewDeploymentService(postgresDB, logger)
	heartbeatService := NewHeartbeatService(postgresDB, logger)

	server, err := NewServer(authService, ingestService, deploymentService, heartbeatService, logger, cfg.Ingest)
	if err != nil {
		logger.Error("main: failed to initialize ingest server", slog.Any("error", err))
		return err
	}

	server.Start()

	logger.Info("main: ingest service started",
		slog.String("service_name", ServiceName),
		slog.String("environment", cfg.App.Environment),
	)

	<-ctx.Done()

	logger.Info("main: shutting down ingest service")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), DefaultShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Warn("main: failed to shutdown ingest server", slog.Any("error", err))
	}

	backgroundManager.Wait()
	return nil
}
