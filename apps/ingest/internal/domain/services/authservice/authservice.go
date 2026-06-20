package authservice

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/background"
)

type Service interface {
	ResolveIngestionKey(ctx context.Context, rawKey string) (*models.ResolvedIngestionKey, apperr.Error)
}
type cacheEntry struct {
	resolved  models.ResolvedIngestionKey
	expiresAt time.Time
}

type service struct {
	postgres          *postgres.Client
	logger            *slog.Logger
	backgroundManager *background.Manager

	mu    sync.RWMutex
	cache map[string]cacheEntry
}

func New(postgres *postgres.Client, logger *slog.Logger, backgroundManager *background.Manager) Service {
	return &service{
		postgres:          postgres,
		logger:            logger,
		backgroundManager: backgroundManager,
		cache:             make(map[string]cacheEntry),
	}
}
