package chdb

import (
	"context"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type DBTX interface {
	PrepareBatch(ctx context.Context, query string, opts ...driver.PrepareBatchOption) (driver.Batch, error)
}

func New(db DBTX) *Queries {
	return &Queries{db: db}
}

type Queries struct {
	db DBTX
}
