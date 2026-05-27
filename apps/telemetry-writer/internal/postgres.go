package writer

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, config PostgresConfig) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, config.URL)
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

func (db *Postgres) Close() {
	db.pool.Close()
}
