package httpapi

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/orvo-sh/orvo/apps/ingest/internal/auth"
	"github.com/orvo-sh/orvo/apps/ingest/internal/config"
	"github.com/orvo-sh/orvo/apps/ingest/internal/observability"
	"github.com/orvo-sh/orvo/apps/ingest/internal/telemetry"
)

type Server struct {
	logger     *slog.Logger
	httpServer *http.Server
	listener   net.Listener
}

func New(authService *auth.Service, ingestService *telemetry.Service, logger *slog.Logger, cfg config.IngestConfig) (*Server, error) {
	mux := http.NewServeMux()
	mux.Handle("/v1/logs", &signalHandler{
		authService:   authService,
		ingestService: ingestService,
		maxBodyBytes:  cfg.MaxBodyBytes,
		signal:        "logs",
	})
	mux.Handle("/v1/traces", &signalHandler{
		authService:   authService,
		ingestService: ingestService,
		maxBodyBytes:  cfg.MaxBodyBytes,
		signal:        "traces",
	})
	mux.Handle("/v1/metrics", &signalHandler{
		authService:   authService,
		ingestService: ingestService,
		maxBodyBytes:  cfg.MaxBodyBytes,
		signal:        "metrics",
	})
	mux.HandleFunc("/health", func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("OK"))
	})
	mux.HandleFunc("/ready", func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("OK"))
	})

	handler := corsMiddleware(requestIDMiddleware(selfTelemetryMiddleware(otelhttp.NewHandler(mux, "ingest.http"))))
	addr := net.JoinHostPort(cfg.HTTPHost, cfg.HTTPPort)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("listen ingest http on %s: %w", addr, err)
	}

	return &Server{
		logger: logger.With("component", "ingest"),
		httpServer: &http.Server{
			Addr:         addr,
			Handler:      handler,
			ReadTimeout:  cfg.ReadTimeout,
			WriteTimeout: cfg.WriteTimeout,
			IdleTimeout:  cfg.IdleTimeout,
		},
		listener: listener,
	}, nil
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
		writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Content-Encoding, Traceparent, Tracestate, Baggage, "+observability.SelfTelemetryHeader)
		writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		writer.Header().Set("Access-Control-Max-Age", "86400")

		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(writer, request)
	})
}

func selfTelemetryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get(observability.SelfTelemetryHeader) == "true" {
			request = request.WithContext(observability.WithSelfTelemetry(request.Context()))
		}

		next.ServeHTTP(writer, request)
	})
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
