package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	ingest "github.com/orvo-sh/orvo/apps/ingest/internal"
)

func main() {
	ctx := context.Background()

	cfg, err := ingest.LoadConfig()
	if err != nil {
		panic(err)
	}

	logger := ingest.NewLogger(ingest.LoggerConfig{
		ServiceName: ingest.ServiceName,
		Environment: cfg.App.Environment,
	})

	shutdownOtel, err := ingest.SetupOTel(ctx, cfg.App, cfg.Otel)
	if err != nil {
		logger.Error("main: failed to initialize OpenTelemetry", slog.Any("error", err))
		os.Exit(1)
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := shutdownOtel(shutdownCtx); err != nil {
			logger.Warn("main: failed to shutdown OpenTelemetry", slog.Any("error", err))
		}
	}()

	postgresDB, err := ingest.NewPostgres(ctx, cfg.Postgres)
	if err != nil {
		logger.Error("main: failed to initialize postgres", slog.Any("error", err))
		os.Exit(1)
	}
	defer postgresDB.Close()

	natsClient, err := ingest.NewNATSClient(ctx, logger, cfg.Nats)
	if err != nil {
		logger.Error("main: failed to initialize nats", slog.Any("error", err))
		os.Exit(1)
	}
	defer natsClient.Close()

	backgroundManager := ingest.NewBackgroundManager(logger, ingest.BackgroundConfig{
		DefaultTimeout: ingest.DefaultBackgroundTimeout,
	})

	authService := ingest.NewAuthService(postgresDB, logger, backgroundManager, cfg.Ingest.ApiKeyCacheTTL)
	ingestService := ingest.NewIngestService(natsClient, logger)

	server, err := ingest.NewServer(authService, ingestService, logger, cfg.Ingest)
	if err != nil {
		logger.Error("main: failed to initialize ingest server", slog.Any("error", err))
		os.Exit(1)
	}

	server.Start()

	logger.Info("main: ingest service started",
		slog.String("service_name", ingest.ServiceName),
		slog.String("environment", cfg.App.Environment),
	)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	logger.Info("main: shutting down ingest service")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), ingest.DefaultShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Warn("main: failed to shutdown ingest server", slog.Any("error", err))
	}

	backgroundManager.Wait()
}
