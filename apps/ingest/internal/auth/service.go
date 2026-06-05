package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/orvo-sh/orvo/apps/ingest/internal/apperrors"
	"github.com/orvo-sh/orvo/apps/ingest/internal/background"
	"github.com/orvo-sh/orvo/apps/ingest/internal/storage/postgres"
)

type IngestionKey struct {
	ID             string
	OrganizationID string
	AppID          string
	Key            string
	Kind           string
	LastUsedAt     *time.Time
	CreatedAt      time.Time
	RevokedAt      *time.Time
}

type ResolvedIngestionKey struct {
	OrganizationID string
	AppID          string
	IngestionKeyID string
	Kind           string
}

type cacheEntry struct {
	resolved  ResolvedIngestionKey
	expiresAt time.Time
}

type Service struct {
	store             *postgres.Client
	logger            *slog.Logger
	backgroundManager *background.Manager
	cacheTTL          time.Duration

	mu    sync.RWMutex
	cache map[string]cacheEntry
}

func New(store *postgres.Client, logger *slog.Logger, backgroundManager *background.Manager, cacheTTL time.Duration) *Service {
	return &Service{
		store:             store,
		logger:            logger,
		backgroundManager: backgroundManager,
		cacheTTL:          cacheTTL,
		cache:             make(map[string]cacheEntry),
	}
}

func (service *Service) ResolveIngestionKey(ctx context.Context, rawKey string) (*ResolvedIngestionKey, apperrors.AppError) {
	service.logger.InfoContext(ctx, "ResolveIngestionKey: resolving ingestion key")

	service.mu.RLock()
	if entry, ok := service.cache[rawKey]; ok && time.Now().Before(entry.expiresAt) {
		service.mu.RUnlock()
		return &entry.resolved, nil
	}
	service.mu.RUnlock()

	ingestionKey, err := service.getIngestionKey(ctx, rawKey)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrIngestionKeyNotFound
		}
		service.logger.ErrorContext(ctx, "ResolveIngestionKey: failed to get ingestion key", slog.Any("error", err))
		return nil, apperrors.ErrInternal
	}

	resolved := ResolvedIngestionKey{
		OrganizationID: ingestionKey.OrganizationID,
		AppID:          ingestionKey.AppID,
		IngestionKeyID: ingestionKey.ID,
		Kind:           ingestionKey.Kind,
	}

	service.mu.Lock()
	service.cache[rawKey] = cacheEntry{
		resolved:  resolved,
		expiresAt: time.Now().Add(service.cacheTTL),
	}
	service.mu.Unlock()

	service.backgroundManager.Run(func(ctx context.Context) {
		if err := service.updateIngestionKeyLastUsed(ctx, ingestionKey.ID); err != nil {
			service.logger.Error("ResolveIngestionKey: failed to update last_used_at", slog.Any("error", err))
		}
	})

	return &resolved, nil
}

const bearerPrefix = "Bearer "

const missingIngestionKeyMessage = "missing ingestion key"

func extractIngestionKey(authorization string) string {
	if strings.HasPrefix(authorization, bearerPrefix) {
		return strings.TrimSpace(strings.TrimPrefix(authorization, bearerPrefix))
	}

	return ""
}

func (service *Service) ResolveRequest(request *http.Request) (*ResolvedIngestionKey, error) {
	rawKey := extractIngestionKey(request.Header.Get("Authorization"))
	if rawKey == "" {
		return nil, fmt.Errorf(missingIngestionKeyMessage)
	}

	resolved, appErr := service.ResolveIngestionKey(request.Context(), rawKey)
	if appErr != nil {
		return nil, fmt.Errorf("invalid ingestion key")
	}

	return resolved, nil
}

func (service *Service) getIngestionKey(ctx context.Context, rawKey string) (*IngestionKey, error) {
	const query = `
SELECT ingestion_key.id, app.organization_id, ingestion_key.app_id, ingestion_key.key, ingestion_key.kind, ingestion_key.last_used_at, ingestion_key.created_at, ingestion_key.revoked_at
FROM ingestion_key
JOIN app ON app.id = ingestion_key.app_id
WHERE key = $1
  AND ingestion_key.revoked_at IS NULL
`

	var ingestionKey IngestionKey
	if err := service.store.Pool().QueryRow(ctx, query, rawKey).Scan(
		&ingestionKey.ID,
		&ingestionKey.OrganizationID,
		&ingestionKey.AppID,
		&ingestionKey.Key,
		&ingestionKey.Kind,
		&ingestionKey.LastUsedAt,
		&ingestionKey.CreatedAt,
		&ingestionKey.RevokedAt,
	); err != nil {
		return nil, fmt.Errorf("postgres: get ingestion key: %w", err)
	}

	return &ingestionKey, nil
}

func (service *Service) updateIngestionKeyLastUsed(ctx context.Context, ingestionKeyID string) error {
	const query = `
UPDATE ingestion_key
SET last_used_at = NOW()
WHERE id = $1
`

	if _, err := service.store.Pool().Exec(ctx, query, ingestionKeyID); err != nil {
		return fmt.Errorf("postgres: update ingestion key last_used_at: %w", err)
	}

	return nil
}
