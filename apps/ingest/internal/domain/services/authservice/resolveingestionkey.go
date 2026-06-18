package authservice

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
)

func (service *service) ResolveRequest(request *http.Request) (*models.ResolvedIngestionKey, error) {
	rawKey := extractIngestionKey(request.Header.Get("Authorization"))
	if rawKey == "" {
		return nil, fmt.Errorf("missing ingestion key")
	}

	resolved, appErr := service.ResolveIngestionKey(request.Context(), rawKey)
	if appErr != nil {
		return nil, fmt.Errorf("invalid ingestion key")
	}

	return resolved, nil
}

func (service *service) ResolveIngestionKey(ctx context.Context, rawKey string) (*models.ResolvedIngestionKey, apperr.Error) {
	service.logger.InfoContext(ctx, "ResolveIngestionKey: resolving ingestion key")

	service.mu.RLock()
	if entry, ok := service.cache[rawKey]; ok && time.Now().Before(entry.expiresAt) {
		service.mu.RUnlock()
		return &entry.resolved, nil
	}
	service.mu.RUnlock()

	row, err := service.postgres.Queries().GetActiveIngestionKeyByKey(ctx, rawKey)
	if err != nil {
		if pgutil.IsNoRows(err) {
			return nil, errs.ErrIngestionKeyNotFound
		}
		service.logger.ErrorContext(ctx, "ResolveIngestionKey: failed to get ingestion key", "error", err)
		return nil, errs.ErrInternal
	}

	resolved := models.ResolvedIngestionKey{
		OrganizationID: row.OrganizationID,
		AppID:          row.AppID,
		IngestionKeyID: row.IngestionKeyID,
		Kind:           row.Kind,
	}

	service.mu.Lock()
	service.cache[rawKey] = cacheEntry{
		resolved:  resolved,
		expiresAt: time.Now().Add(service.cacheTTL),
	}
	service.mu.Unlock()

	service.backgroundManager.Run(func(ctx context.Context) {
		if err := service.postgres.Queries().TouchIngestionKeyLastUsed(ctx, row.IngestionKeyID); err != nil {
			service.logger.Error("ResolveIngestionKey: failed to update last_used_at", "error", err)
		}
	})

	return &resolved, nil
}
