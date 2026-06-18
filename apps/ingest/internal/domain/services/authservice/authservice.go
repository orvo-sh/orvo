package authservice

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/background"
)

type Service interface {
	ResolveRequest(request *http.Request) (*models.ResolvedIngestionKey, error)
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
	cacheTTL          time.Duration

	mu    sync.RWMutex
	cache map[string]cacheEntry
}

func New(postgres *postgres.Client, logger *slog.Logger, backgroundManager *background.Manager, cacheTTL time.Duration) Service {
	return &service{
		postgres:          postgres,
		logger:            logger,
		backgroundManager: backgroundManager,
		cacheTTL:          cacheTTL,
		cache:             make(map[string]cacheEntry),
	}
}

const bearerPrefix = "Bearer "

func extractIngestionKey(authorization string) string {
	if strings.HasPrefix(authorization, bearerPrefix) {
		return strings.TrimSpace(strings.TrimPrefix(authorization, bearerPrefix))
	}
	return ""
}
