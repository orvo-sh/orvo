package postgres

import (
	"context"
	"fmt"
	"net/url"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
)

type Client struct {
	pool    *pgxpool.Pool
	queries *pgdb.Queries
}

func New(ctx context.Context, connectionString string) (*Client, error) {
	postgresURL, err := url.Parse(connectionString)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse URL: %w", err)
	}

	query := postgresURL.Query()
	query.Del("uselibpqcompat")
	singleUse := query.Get("orvo_single_use") == "true"
	query.Del("orvo_single_use")
	postgresURL.RawQuery = query.Encode()

	poolConfig, err := pgxpool.ParseConfig(postgresURL.String())
	if err != nil {
		return nil, fmt.Errorf("postgres: parse config: %w", err)
	}

	poolConfig.ConnConfig.Tracer = otelpgx.NewTracer()
	if singleUse {
		poolConfig.MaxConns = 1
		poolConfig.AfterRelease = func(*pgx.Conn) bool { return false }
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("postgres: create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres: ping failed: %w", err)
	}

	return &Client{
		pool:    pool,
		queries: pgdb.New(pool),
	}, nil
}

func (client *Client) Pool() *pgxpool.Pool {
	return client.pool
}

func (client *Client) Queries() *pgdb.Queries {
	return client.queries
}

func (client *Client) WithTx(tx pgx.Tx) *pgdb.Queries {
	return client.queries.WithTx(tx)
}

func (client *Client) Ping(ctx context.Context) error {
	if err := client.pool.Ping(ctx); err != nil {
		return fmt.Errorf("postgres: ping failed: %w", err)
	}

	return nil
}

func (client *Client) Close() {
	client.pool.Close()
}
