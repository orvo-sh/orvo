package ingest

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

type Server struct {
	logger     *slog.Logger
	httpServer *http.Server
	listener   net.Listener
}

func NewServer(authService *AuthService, ingestService *TelemetryService, deploymentService *DeploymentService, logger *slog.Logger, cfg IngestConfig) (*Server, error) {
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
	mux.HandleFunc("/v1/deployments", func(writer http.ResponseWriter, request *http.Request) {
		resolved, err := authService.ResolveRequest(request)
		if err != nil {
			writeAppError(writer, ErrInvalidIngestionKey)
			return
		}

		deploymentService.handleCreate(writer, request, resolved)
	})
	mux.HandleFunc("/v1/deployments/", func(writer http.ResponseWriter, request *http.Request) {
		resolved, err := authService.ResolveRequest(request)
		if err != nil {
			writeAppError(writer, ErrInvalidIngestionKey)
			return
		}

		deploymentID, err := deploymentIDFromPath(request.URL.Path)
		if err != nil {
			writeAppError(writer, ErrDeploymentNotFound)
			return
		}

		deploymentService.handleUpdate(writer, request, resolved, deploymentID)
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
		writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Content-Encoding, Traceparent, Tracestate, Baggage, "+SelfTelemetryHeader)
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
		if request.Header.Get(SelfTelemetryHeader) == "true" {
			request = request.WithContext(WithSelfTelemetry(request.Context()))
		}

		next.ServeHTTP(writer, request)
	})
}

const (
	requestIDContextKey = "requestid.ContextKey"
	requestIDHeaderName = "X-Request-Id"
)

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestID := request.Header.Get(requestIDHeaderName)
		if requestID == "" {
			requestID = GenerateID("req")
		}

		writer.Header().Set(requestIDHeaderName, requestID)
		ctx := context.WithValue(request.Context(), requestIDContextKey, requestID)
		next.ServeHTTP(writer, request.WithContext(ctx))
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
