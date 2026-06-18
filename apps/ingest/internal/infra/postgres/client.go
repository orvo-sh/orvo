package postgres

import (
	"context"
	"fmt"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
)

type Client struct {
	pool    *pgxpool.Pool
	queries *pgdb.Queries
}

func New(ctx context.Context, url string) (*Client, error) {
	poolConfig, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse config: %w", err)
	}

	poolConfig.ConnConfig.Tracer = otelpgx.NewTracer()

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
