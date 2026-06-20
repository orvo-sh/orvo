package test

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"testing"
	"time"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/authservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	ingesthttp "github.com/orvo-sh/orvo/apps/ingest/internal/http"
	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/background"
)

func WithIngestServer(
	t *testing.T,
	postgresDB *pgclient.Client,
	clickhouseDB *chclient.Client,
	_ chdriver.Conn,
	fn func(addr string),
) {
	t.Helper()

	logger := NewLogger(t)
	backgroundManager := background.New(logger)

	authService := authservice.New(postgresDB, logger, backgroundManager)
	billingService := billingservice.New(postgresDB, logger)
	ingestService := ingestservice.New(
		postgresDB,
		clickhouseDB,
		logger,
		billingService,
		ingestservice.Config{
			Logs: ingestservice.IngestBatcherConfig{
				FlushInterval: 10 * time.Millisecond,
				MaxQueueSize:  10,
				BatchSize:     1,
			},
			Traces: ingestservice.IngestBatcherConfig{
				FlushInterval: 10 * time.Millisecond,
				MaxQueueSize:  10,
				BatchSize:     1,
			},
			Metrics: ingestservice.IngestBatcherConfig{
				FlushInterval: 10 * time.Millisecond,
				MaxQueueSize:  10,
				BatchSize:     1,
			},
			HeartbeatCheckIns: ingestservice.IngestBatcherConfig{
				FlushInterval: 10 * time.Millisecond,
				MaxQueueSize:  10,
				BatchSize:     1,
			},
		},
	)
	defer func() {
		ingestService.Close()
		backgroundManager.Wait()
	}()

	server, addr := newServer(t, authService, ingestService, logger)
	defer shutdownServer(t, server)

	waitForServer(t, "http://"+addr+"/health")
	fn(addr)
}

func newServer(
	t *testing.T,
	authService authservice.Service,
	ingestService ingestservice.Service,
	logger *slog.Logger,
) (*ingesthttp.Server, string) {
	t.Helper()

	port := freePort(t)
	server, err := ingesthttp.New(
		authService,
		ingestService,
		logger,
		ingesthttp.Config{
			Port: port,
		},
	)
	if err != nil {
		t.Fatalf("create ingest http server: %v", err)
	}

	server.Start()
	return server, net.JoinHostPort("127.0.0.1", port)
}

func shutdownServer(t *testing.T, server *ingesthttp.Server) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		t.Fatalf("shutdown ingest http server: %v", err)
	}
}

func freePort(t *testing.T) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("allocate port: %v", err)
	}
	defer listener.Close()

	_, port, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		t.Fatalf("split host port: %v", err)
	}

	return port
}

func waitForServer(t *testing.T, url string) {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		response, err := http.Get(url)
		if err == nil {
			_ = response.Body.Close()
			if response.StatusCode == http.StatusOK {
				return
			}
		}

		time.Sleep(25 * time.Millisecond)
	}

	t.Fatalf("server did not become ready: %s", url)
}
