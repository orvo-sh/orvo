package billingservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

type ReservationSignal string

const (
	ReservationSignal_Logs    = "logs"
	ReservationSignal_Traces  = "traces"
	ReservationSignal_Metrics = "metrics"
)

type Service interface {
	ReserveSignalUsage(ctx context.Context, input ReserveSignalUsageInput) apperr.Error
	ReleaseSignalUsage(ctx context.Context, input ReleaseSignalUsageInput) apperr.Error
}

type service struct {
	postgres *postgres.Client
	logger   *slog.Logger
}

func New(
	postgres *postgres.Client,
	logger *slog.Logger,
) Service {
	return &service{
		postgres: postgres,
		logger:   logger,
	}
}
