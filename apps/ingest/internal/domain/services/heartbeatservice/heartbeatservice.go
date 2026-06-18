package heartbeatservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

type checkInWorker interface {
	EnqueueHeartbeatCheckIn(ctx context.Context, checkIn models.HeartbeatCheckIn) error
}

type Service interface {
	RecordCheckIn(ctx context.Context, token string) (time.Time, apperr.Error)
}

type service struct {
	postgres      *postgres.Client
	checkInWorker checkInWorker
	logger        *slog.Logger
}

func New(postgres *postgres.Client, checkInWorker checkInWorker, logger *slog.Logger) Service {
	return &service{
		postgres:      postgres,
		checkInWorker: checkInWorker,
		logger:        logger,
	}
}
