package test

import (
	"context"
	"fmt"
	"net"
	"path/filepath"
	"testing"

	ch "github.com/ClickHouse/clickhouse-go/v2"
	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/testcontainers/testcontainers-go/modules/clickhouse"

	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
)

func WithClickhouseDB(t *testing.T, fn func(*chclient.Client, chdriver.Conn)) {
	t.Helper()

	ctx := context.Background()
	container, err := clickhouse.Run(
		ctx,
		"clickhouse/clickhouse-server:25.6",
		clickhouse.WithDatabase("orvo_ingest_test"),
		clickhouse.WithUsername("default"),
		clickhouse.WithPassword("password"),
	)
	if err != nil {
		t.Fatalf("start clickhouse container: %v", err)
	}
	defer func() {
		if err := container.Terminate(ctx); err != nil {
			t.Fatalf("terminate clickhouse container: %v", err)
		}
	}()

	host, err := container.Host(ctx)
	if err != nil {
		t.Fatalf("get clickhouse host: %v", err)
	}

	port, err := container.MappedPort(ctx, "9000")
	if err != nil {
		t.Fatalf("get clickhouse port: %v", err)
	}

	addr := net.JoinHostPort(host, port.Port())
	options := &ch.Options{
		Addr: []string{addr},
		Auth: ch.Auth{
			Database: "orvo_ingest_test",
			Username: "default",
			Password: "password",
		},
	}

	rawConn, err := ch.Open(options)
	if err != nil {
		t.Fatalf("open clickhouse connection: %v", err)
	}
	defer func() {
		if err := rawConn.Close(); err != nil {
			t.Fatalf("close clickhouse connection: %v", err)
		}
	}()

	if err := rawConn.Ping(ctx); err != nil {
		t.Fatalf("ping clickhouse: %v", err)
	}

	applyClickhouseMigrations(t, rawConn)

	client, err := chclient.New(ctx, fmt.Sprintf("clickhouse://default:password@%s/orvo_ingest_test", addr))
	if err != nil {
		t.Fatalf("create clickhouse client: %v", err)
	}
	defer func() {
		if err := client.Close(); err != nil {
			t.Fatalf("close clickhouse client: %v", err)
		}
	}()

	fn(client, rawConn)
}

func applyClickhouseMigrations(t *testing.T, conn chdriver.Conn) {
	t.Helper()

	for _, statement := range migrationStatements(t, filepath.Join(repoRoot(t), "packages/clickhouse/migrations"), "-- statement-breakpoint") {
		if err := conn.Exec(context.Background(), statement); err != nil {
			t.Fatalf("apply clickhouse migration: %v\nstatement:\n%s", err, statement)
		}
	}
}
