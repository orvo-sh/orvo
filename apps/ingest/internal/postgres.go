package ingest

import (
	"context"
	"fmt"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, config PostgresConfig) (*Postgres, error) {
	poolConfig, err := pgxpool.ParseConfig(config.URL)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse config: %w", err)
	}

	poolConfig.ConnConfig.Tracer = otelpgx.NewTracer()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("postgres: create pool: %w", err)
	}

	db := &Postgres{pool: pool}
	if err := db.CheckReady(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return db, nil
}

func (db *Postgres) CheckReady(ctx context.Context) error {
	if err := db.pool.Ping(ctx); err != nil {
		return fmt.Errorf("postgres: ping failed: %w", err)
	}

	return nil
}

func (db *Postgres) GetAPIKeyByHash(ctx context.Context, keyHash string) (*APIKey, error) {
	const query = `
SELECT id, organization_id, key_hash, name, expires_at, last_used_at, created_at, revoked_at
FROM api_key
WHERE key_hash = $1
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
`

	var apiKey APIKey
	if err := db.pool.QueryRow(ctx, query, keyHash).Scan(
		&apiKey.ID,
		&apiKey.OrganizationID,
		&apiKey.KeyHash,
		&apiKey.Name,
		&apiKey.ExpiresAt,
		&apiKey.LastUsedAt,
		&apiKey.CreatedAt,
		&apiKey.RevokedAt,
	); err != nil {
		return nil, fmt.Errorf("postgres: get api key by hash: %w", err)
	}

	return &apiKey, nil
}

func (db *Postgres) UpdateAPIKeyLastUsed(ctx context.Context, keyHash string) error {
	const query = `
UPDATE api_key
SET last_used_at = NOW()
WHERE key_hash = $1
`

	if _, err := db.pool.Exec(ctx, query, keyHash); err != nil {
		return fmt.Errorf("postgres: update api key last_used_at: %w", err)
	}

	return nil
}

func (db *Postgres) Close() {
	db.pool.Close()
}
