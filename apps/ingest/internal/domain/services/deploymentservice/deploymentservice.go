package deploymentservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

type Service interface {
	Create(ctx context.Context, appID string, input CreateInput) (string, apperr.Error)
	Update(ctx context.Context, appID string, deploymentID string, input UpdateInput) apperr.Error
}

type service struct {
	postgres *postgres.Client
	logger   *slog.Logger
}

func New(postgres *postgres.Client, logger *slog.Logger) Service {
	return &service{
		postgres: postgres,
		logger:   logger,
	}
}

type CreateInput struct {
	ServiceName     string
	EnvironmentName string
	Version         *string
	Status          string
	StartedAt       time.Time
	FinishedAt      *time.Time
	GitSHA          *string
	GitBranch       *string
	GitRepository   *string
	GitActor        *string
	CommitMessage   *string
	ExternalURL     *string
	Metadata        []byte
}

type UpdateInput struct {
	Status      *string
	FinishedAt  *time.Time
	ExternalURL *string
	Metadata    []byte
}
