package chdb

import "context"

type Querier interface {
	InsertHeartbeatCheckIns(ctx context.Context, arg []InsertHeartbeatCheckInsParams) error
	InsertLogsRaw(ctx context.Context, arg []InsertLogsRawParams) error
	InsertMetricsRaw(ctx context.Context, arg []InsertMetricsRawParams) error
	InsertTracesRaw(ctx context.Context, arg []InsertTracesRawParams) error
}

var _ Querier = (*Queries)(nil)
