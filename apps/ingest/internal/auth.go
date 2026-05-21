package ingest

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type apiKeyStore interface {
	GetAPIKeyByHash(ctx context.Context, keyHash string) (*APIKey, error)
	UpdateAPIKeyLastUsed(ctx context.Context, keyHash string) error
}

type AuthService struct {
	store             apiKeyStore
	logger            *slog.Logger
	backgroundManager *BackgroundManager
	cacheTTL          time.Duration

	mu    sync.RWMutex
	cache map[string]apiKeyCacheEntry
}

type apiKeyCacheEntry struct {
	resolved  ResolvedAPIKey
	expiresAt time.Time
}

func NewAuthService(store apiKeyStore, logger *slog.Logger, backgroundManager *BackgroundManager, cacheTTL time.Duration) *AuthService {
	return &AuthService{
		store:             store,
		logger:            logger,
		backgroundManager: backgroundManager,
		cacheTTL:          cacheTTL,
		cache:             make(map[string]apiKeyCacheEntry),
	}
}

func (service *AuthService) ResolveAPIKey(ctx context.Context, rawKey string) (*ResolvedAPIKey, AppError) {
	service.logger.InfoContext(ctx, "ResolveAPIKey: resolving API key")

	keyHash := hashKey(rawKey)

	service.mu.RLock()
	if entry, ok := service.cache[keyHash]; ok && time.Now().Before(entry.expiresAt) {
		service.mu.RUnlock()
		return &entry.resolved, nil
	}
	service.mu.RUnlock()

	apiKey, err := service.store.GetAPIKeyByHash(ctx, keyHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAPIKeyNotFound
		}
		service.logger.ErrorContext(ctx, "ResolveAPIKey: failed to get API key by hash", slog.Any("error", err))
		return nil, ErrInternal
	}

	resolved := ResolvedAPIKey{
		OrganizationID: apiKey.OrganizationID,
		APIKeyID:       apiKey.ID,
	}

	service.mu.Lock()
	service.cache[keyHash] = apiKeyCacheEntry{
		resolved:  resolved,
		expiresAt: time.Now().Add(service.cacheTTL),
	}
	service.mu.Unlock()

	service.backgroundManager.Run(func(ctx context.Context) {
		if err := service.store.UpdateAPIKeyLastUsed(ctx, keyHash); err != nil {
			service.logger.Error("ResolveAPIKey: failed to update last_used_at", slog.Any("error", err))
		}
	})

	return &resolved, nil
}

func extractAPIKey(authorization string, apiKeyHeader string) string {
	if apiKeyHeader != "" {
		return apiKeyHeader
	}

	if strings.HasPrefix(authorization, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
	}

	return ""
}

func (service *AuthService) ResolveRequest(request *http.Request) (*ResolvedAPIKey, error) {
	rawKey := extractAPIKey(request.Header.Get("Authorization"), request.Header.Get("X-Api-Key"))
	if rawKey == "" {
		return nil, fmt.Errorf("missing API key")
	}

	resolved, appErr := service.ResolveAPIKey(request.Context(), rawKey)
	if appErr != nil {
		return nil, fmt.Errorf("invalid API key")
	}

	return resolved, nil
}

func hashKey(rawKey string) string {
	sum := sha256.Sum256([]byte(rawKey))
	return hex.EncodeToString(sum[:])
}
