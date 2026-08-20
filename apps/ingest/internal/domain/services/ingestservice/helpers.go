package ingestservice

import (
	"context"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/chutil"
)

func withSignalMeta(meta models.MessageMeta, signal string, appID string, ingestionKeyID string, retentionDays int) models.MessageMeta {
	meta.Version = "v1"
	meta.Signal = signal
	meta.AppID = appID
	meta.IngestionKeyID = ingestionKeyID
	meta.RetentionDays = retentionDays
	if meta.ReceivedAt.IsZero() {
		meta.ReceivedAt = time.Now().UTC()
	}
	return meta
}

func computeExpiresAt(eventTime time.Time, receivedAt time.Time, retentionDays int) time.Time {
	baseTime := chutil.NormalizeTime(eventTime, receivedAt)
	if retentionDays <= 0 {
		return baseTime
	}
	return baseTime.Add(time.Duration(retentionDays) * 24 * time.Hour)
}

func (service *service) getSignalRetentionDays(ctx context.Context, signal billingservice.ReservationSignal, appID string) (int, error) {
	policy, err := service.postgres.Queries().GetAppRetentionPolicy(ctx, appID)
	if err != nil {
		return 0, err
	}

	switch signal {
	case billingservice.ReservationSignal_Logs:
		return int(policy.LogsRetentionDays.Int32), nil
	case billingservice.ReservationSignal_Traces:
		return int(policy.TracesRetentionDays.Int32), nil
	case billingservice.ReservationSignal_Metrics:
		return int(policy.MetricsRetentionDays.Int32), nil
	default:
		return 0, nil
	}
}
