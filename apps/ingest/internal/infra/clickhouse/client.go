package clickhouse

import (
	"context"
	"fmt"

	ch "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse/db"
)

type Client struct {
	conn    driver.Conn
	queries *chdb.Queries
}

func New(ctx context.Context, url string) (*Client, error) {
	options, err := ch.ParseDSN(url)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: parse dsn: %w", err)
	}

	conn, err := ch.Open(options)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: open connection: %w", err)
	}

	if err := conn.Ping(ctx); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("clickhouse: ping failed: %w", err)
	}

	return &Client{
		conn:    conn,
		queries: chdb.New(conn),
	}, nil
}

func (client *Client) Queries() *chdb.Queries {
	return client.queries
}

func (client *Client) Ping(ctx context.Context) error {
	if err := client.conn.Ping(ctx); err != nil {
		return fmt.Errorf("clickhouse: ping failed: %w", err)
	}

	return nil
}

func (client *Client) Close() error {
	return client.conn.Close()
}
