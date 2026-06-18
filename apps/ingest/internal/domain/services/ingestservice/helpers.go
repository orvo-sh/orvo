package ingestservice

import (
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
)

func withSignalMeta(meta models.MessageMeta, signal string, appID string, ingestionKeyID string) models.MessageMeta {
	meta.Version = "v1"
	meta.Signal = signal
	meta.AppID = appID
	meta.IngestionKeyID = ingestionKeyID
	if meta.ReceivedAt.IsZero() {
		meta.ReceivedAt = time.Now().UTC()
	}
	return meta
}
