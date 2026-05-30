package postgres

import (
	"context"
	"fmt"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/config"
)

type Client struct {
	Pool *pgxpool.Pool
}

func New(ctx context.Context, cfg config.PostgresConfig) (*Client, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse config: %w", err)
	}
	poolConfig.ConnConfig.Tracer = otelpgx.NewTracer()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("postgres: create pool: %w", err)
	}

	client := &Client{Pool: pool}
	if err := client.CheckReady(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return client, nil
}

func (client *Client) CheckReady(ctx context.Context) error {
	if err := client.Pool.Ping(ctx); err != nil {
		return fmt.Errorf("postgres: ping failed: %w", err)
	}
	return nil
}

func (client *Client) Close() {
	client.Pool.Close()
}
