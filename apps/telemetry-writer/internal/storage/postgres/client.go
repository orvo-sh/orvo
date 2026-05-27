package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/config"
)

type Client struct {
	Pool *pgxpool.Pool
}

func New(ctx context.Context, cfg config.PostgresConfig) (*Client, error) {
	pool, err := pgxpool.New(ctx, cfg.URL)
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
