package ingesthttp

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/authservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/deploymentservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/heartbeatservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	appotel "github.com/orvo-sh/orvo/apps/ingest/internal/otel"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

type Config struct {
	HTTPHost     string
	HTTPPort     string
	MaxBodyBytes int64
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

type Server struct {
	logger     *slog.Logger
	httpServer *http.Server
	listener   net.Listener
}

type requestIDContextKey struct{}

func New(
	authService authservice.Service,
	ingestService ingestservice.Service,
	deploymentService deploymentservice.Service,
	heartbeatService heartbeatservice.Service,
	logger *slog.Logger,
	config Config,
) (*Server, error) {
	mux := http.NewServeMux()
	mux.Handle("/v1/logs", &signalHandler{
		authService:   authService,
		ingestService: ingestService,
		maxBodyBytes:  config.MaxBodyBytes,
		signal:        "logs",
	})
	mux.Handle("/v1/traces", &signalHandler{
		authService:   authService,
		ingestService: ingestService,
		maxBodyBytes:  config.MaxBodyBytes,
		signal:        "traces",
	})
	mux.Handle("/v1/metrics", &signalHandler{
		authService:   authService,
		ingestService: ingestService,
		maxBodyBytes:  config.MaxBodyBytes,
		signal:        "metrics",
	})

	deployments := &deploymentHandler{
		authService:       authService,
		deploymentService: deploymentService,
	}
	heartbeats := &heartbeatHandler{heartbeatService: heartbeatService}

	mux.HandleFunc("/v1/deployments", deployments.handleCreate)
	mux.HandleFunc("/v1/deployments/", deployments.handleUpdate)
	mux.HandleFunc("/v1/heartbeats/", heartbeats.handleCheckIn)
	mux.HandleFunc("/health", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]bool{"ok": true})
	})
	mux.HandleFunc("/ready", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]bool{"ok": true})
	})

	handler := corsMiddleware(requestIDMiddleware(selfTelemetryMiddleware(otelhttp.NewHandler(mux, "ingest.http"))))
	addr := net.JoinHostPort(config.HTTPHost, config.HTTPPort)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("listen ingest http on %s: %w", addr, err)
	}

	return &Server{
		logger: logger.With("component", "http"),
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
		server.logger.Info("Start: serving http", slog.String("addr", server.listener.Addr().String()))
		if err := server.httpServer.Serve(server.listener); err != nil && err != http.ErrServerClosed {
			server.logger.Error("Start: http server stopped unexpectedly", slog.Any("error", err))
		}
	}()
}

func (server *Server) Shutdown(ctx context.Context) error {
	if err := server.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("shutdown ingest http server: %w", err)
	}

	return nil
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
		writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Content-Encoding, Traceparent, Tracestate, Baggage, "+appotel.SelfTelemetryHeader)
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
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
		if request.Header.Get(appotel.SelfTelemetryHeader) == "true" {
			request = request.WithContext(appotel.WithSelfTelemetry(request.Context()))
		}

		next.ServeHTTP(writer, request)
	})
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestID := request.Header.Get(requestIDHeaderName)
		if requestID == "" {
			requestID = util.GenerateID("req")
		}

		writer.Header().Set(requestIDHeaderName, requestID)
		ctx := context.WithValue(request.Context(), requestIDContextKey{}, requestID)
		next.ServeHTTP(writer, request.WithContext(ctx))
	})
}
