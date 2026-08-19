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
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/http/handlers"
	httpmiddleware "github.com/orvo-sh/orvo/apps/ingest/internal/http/middleware"
	appotel "github.com/orvo-sh/orvo/apps/ingest/internal/otel"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

type requestIDContextKey struct{}

type Config struct {
	Host string
	Port string
}

type Server struct {
	logger     *slog.Logger
	httpServer *http.Server
	listener   net.Listener
}

func New(
	authService authservice.Service,
	ingestService ingestservice.Service,
	logger *slog.Logger,
	config Config,
) (*Server, error) {
	mux := http.NewServeMux()
	resolveIngestionKey := httpmiddleware.NewIngestionKeyResolver(authService)
	mux.Handle("/v1/logs", resolveIngestionKey(handlers.NewLogsHandler(ingestService)))
	mux.Handle("/v1/traces", resolveIngestionKey(handlers.NewTracesHandler(ingestService)))
	mux.Handle("/v1/metrics", resolveIngestionKey(handlers.NewMetricsHandler(ingestService)))
	mux.HandleFunc("/v1/heartbeats/{token}", handlers.NewHeartbeatHandler(ingestService))
	mux.HandleFunc("/health", func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(`{"ok":true}`))
	})
	mux.HandleFunc("/ready", func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(`{"ok":true}`))
	})

	handler := chain(
		otelhttp.NewHandler(mux, "ingest.http", otelhttp.WithFilter(func(request *http.Request) bool {
			return request.Header.Get("X-Orvo-Self-Telemetry") != "true"
		})),
		func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				if request.Header.Get("X-Orvo-Self-Telemetry") == "true" {
					request = request.WithContext(appotel.WithSelfTelemetry(request.Context()))
				}
				next.ServeHTTP(writer, request)
			})
		},
		func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				requestID := request.Header.Get("X-Request-Id")
				if requestID == "" {
					requestID = util.GenerateID("req")
				}

				writer.Header().Set("X-Request-Id", requestID)
				ctx := context.WithValue(request.Context(), requestIDContextKey{}, requestID)
				next.ServeHTTP(writer, request.WithContext(ctx))
			})
		},
		func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.Header().Set("Access-Control-Allow-Origin", "*")
				writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Content-Encoding, Traceparent, Tracestate, Baggage, "+"X-Orvo-Self-Telemetry")
				writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
				writer.Header().Set("Access-Control-Max-Age", "86400")
				if request.Method == http.MethodOptions {
					writer.WriteHeader(http.StatusNoContent)
					return
				}
				next.ServeHTTP(writer, request)
			})
		},
	)

	addr := net.JoinHostPort(config.Host, config.Port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("listen ingest http on %s: %w", addr, err)
	}

	return &Server{
		logger: logger.With("component", "http"),
		httpServer: &http.Server{
			Addr:         addr,
			Handler:      handler,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
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

func chain(next http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for index := len(middlewares) - 1; index >= 0; index-- {
		next = middlewares[index](next)
	}

	return next
}
