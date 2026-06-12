package ingest

import (
	"context"
	"fmt"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresClient struct {
	pool *pgxpool.Pool
}

func NewPostgresClient(ctx context.Context, cfg PostgresConfig) (*PostgresClient, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse config: %w", err)
	}

	poolConfig.ConnConfig.Tracer = otelpgx.NewTracer()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("postgres: create pool: %w", err)
	}

	client := &PostgresClient{pool: pool}
	if err := client.CheckReady(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return client, nil
}

func (client *PostgresClient) CheckReady(ctx context.Context) error {
	if err := client.pool.Ping(ctx); err != nil {
		return fmt.Errorf("postgres: ping failed: %w", err)
	}

	return nil
}

func (client *PostgresClient) Pool() *pgxpool.Pool {
	return client.pool
}

func (client *PostgresClient) Close() {
	client.pool.Close()
}
