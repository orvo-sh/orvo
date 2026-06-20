package authservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) ResolveIngestionKey(ctx context.Context, rawKey string) (*models.ResolvedIngestionKey, apperr.Error) {
	service.logger.InfoContext(ctx, "ResolveIngestionKey: resolving ingestion key", slog.String("ingestion_key", util.Redact(rawKey, 4, util.RedactDirectionEnd)))

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
		service.logger.ErrorContext(ctx, "ResolveIngestionKey: failed to get ingestion key", "error", slog.Any("error", err))
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
		expiresAt: time.Now().Add(5 * time.Minute),
	}
	service.mu.Unlock()

	service.backgroundManager.Run(func(ctx context.Context) {
		if err := service.postgres.Queries().TouchIngestionKeyLastUsed(ctx, row.IngestionKeyID); err != nil {
			service.logger.Error("ResolveIngestionKey: failed to update last_used_at", "error", err)
		}
	})

	return &resolved, nil
}
