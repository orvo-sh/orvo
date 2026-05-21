package ingest

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

type readinessChecker interface {
	CheckReady(ctx context.Context) error
}

type Server struct {
	logger     *slog.Logger
	httpServer *http.Server
	listener   net.Listener
}

func NewServer(authService *AuthService, ingestService *IngestService, logger *slog.Logger, config IngestConfig, readinessCheckers ...readinessChecker) (*Server, error) {
	mux := http.NewServeMux()
	mux.Handle("/v1/logs", &httpLogHandler{
		authService:   authService,
		ingestService: ingestService,
		logger:        logger,
		maxBodyBytes:  config.MaxBodyBytes,
	})
	mux.Handle("/v1/traces", &httpTraceHandler{
		authService:   authService,
		ingestService: ingestService,
		logger:        logger,
		maxBodyBytes:  config.MaxBodyBytes,
	})
	mux.Handle("/v1/metrics", &httpMetricHandler{
		authService:   authService,
		ingestService: ingestService,
		logger:        logger,
		maxBodyBytes:  config.MaxBodyBytes,
	})
	mux.HandleFunc("/health", func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("OK"))
	})
	mux.HandleFunc("/ready", func(writer http.ResponseWriter, request *http.Request) {
		for _, checker := range readinessCheckers {
			if err := checker.CheckReady(request.Context()); err != nil {
				logger.ErrorContext(request.Context(), "Ready: dependency not ready", slog.Any("error", err))
				http.Error(writer, http.StatusText(http.StatusServiceUnavailable), http.StatusServiceUnavailable)
				return
			}
		}

		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("OK"))
	})

	handler := requestIDMiddleware(otelhttp.NewHandler(mux, "ingest.http"))
	addr := net.JoinHostPort(config.HTTPHost, config.HTTPPort)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("listen ingest http on %s: %w", addr, err)
	}

	return &Server{
		logger: logger.With("component", "ingest"),
		httpServer: &http.Server{
			Addr:         addr,
			Handler:      handler,
			ReadTimeout:  config.ReadTimeout,
			WriteTimeout: config.WriteTimeout,
			IdleTimeout:  config.IdleTimeout,
		},
		listener: listener,
	}, nil
}

func (server *Server) Start() {
	go func() {
		server.logger.Info("OTLP/HTTP receiver listening", slog.String("addr", server.listener.Addr().String()))
		if err := server.httpServer.Serve(server.listener); err != nil && err != http.ErrServerClosed {
			server.logger.Error("HTTP ingest server stopped", slog.Any("error", err))
		}
	}()
}

func (server *Server) Shutdown(ctx context.Context) error {
	if err := server.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("shutdown ingest http server: %w", err)
	}

	return nil
}
