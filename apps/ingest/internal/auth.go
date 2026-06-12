package ingest

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

type AuthService struct {
	store             *PostgresClient
	logger            *slog.Logger
	backgroundManager *BackgroundManager
	cacheTTL          time.Duration

	mu    sync.RWMutex
	cache map[string]cacheEntry
}

func NewAuthService(store *PostgresClient, logger *slog.Logger, backgroundManager *BackgroundManager, cacheTTL time.Duration) *AuthService {
	return &AuthService{
		store:             store,
		logger:            logger,
		backgroundManager: backgroundManager,
		cacheTTL:          cacheTTL,
		cache:             make(map[string]cacheEntry),
	}
}

func (service *AuthService) ResolveIngestionKey(ctx context.Context, rawKey string) (*ResolvedIngestionKey, AppError) {
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
			return nil, ErrIngestionKeyNotFound
		}
		service.logger.ErrorContext(ctx, "ResolveIngestionKey: failed to get ingestion key", slog.Any("error", err))
		return nil, ErrInternal
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

func (service *AuthService) ResolveRequest(request *http.Request) (*ResolvedIngestionKey, error) {
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

func (service *AuthService) getIngestionKey(ctx context.Context, rawKey string) (*IngestionKey, error) {
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

func (service *AuthService) updateIngestionKeyLastUsed(ctx context.Context, ingestionKeyID string) error {
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
