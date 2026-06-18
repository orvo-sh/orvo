package heartbeatservice

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) RecordCheckIn(ctx context.Context, token string) (time.Time, apperr.Error) {
	service.logger.InfoContext(ctx, "RecordCheckIn: recording heartbeat check-in")

	tx, err := service.postgres.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to begin transaction", "error", err)
		return time.Time{}, errs.ErrInternal
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := pgdb.New(tx)

	monitor, err := queries.GetHeartbeatMonitorByToken(ctx, token)
	if err != nil {
		if pgutil.IsNoRows(err) {
			return time.Time{}, errs.ErrHeartbeatMonitorNotFound
		}
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to load heartbeat monitor", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	now := time.Now().UTC()
	if err := queries.MarkHeartbeatMonitorHealthy(ctx, pgdb.MarkHeartbeatMonitorHealthyParams{
		ID:            monitor.ID,
		LastCheckInAt: pgutil.Timestamp(now),
	}); err != nil {
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to update heartbeat monitor", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	if err := queries.MarkAppHeartbeatsFirstReceived(ctx, pgdb.MarkAppHeartbeatsFirstReceivedParams{
		ID:                        monitor.AppID,
		HeartbeatsFirstReceivedAt: pgutil.Timestamp(now),
	}); err != nil {
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to update first received timestamp", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	if monitor.LastStatus == "missed" {
		if err := service.insertRecoveryDeliveries(ctx, queries, heartbeatDeliveryInput{
			AppID:                monitor.AppID,
			AppName:              monitor.AppName,
			HeartbeatID:          monitor.ID,
			HeartbeatName:        monitor.Name,
			Token:                monitor.Token,
			ExpectedEverySeconds: int(monitor.ExpectedEverySeconds),
			GraceSeconds:         int(monitor.GraceSeconds),
			LastCheckInAt:        pgutil.TimestampToPtr(monitor.LastCheckInAt),
			LastMissedAt:         pgutil.TimestampToPtr(monitor.LastMissedAt),
			LastRecoveredAt:      &now,
		}, now); err != nil {
			service.logger.ErrorContext(ctx, "RecordCheckIn: failed to insert recovery deliveries", "error", err)
			return time.Time{}, errs.ErrInternal
		}
	}

	if err := tx.Commit(ctx); err != nil {
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to commit transaction", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	if service.checkInWorker != nil {
		if err := service.checkInWorker.EnqueueHeartbeatCheckIn(ctx, models.HeartbeatCheckIn{
			AppID:                monitor.AppID,
			HeartbeatMonitorID:   monitor.ID,
			HeartbeatName:        monitor.Name,
			CheckedInAt:          now,
			PreviousStatus:       monitor.LastStatus,
			Recovered:            monitor.LastStatus == "missed",
			ExpectedEverySeconds: int(monitor.ExpectedEverySeconds),
			GraceSeconds:         int(monitor.GraceSeconds),
			LastCheckInAt:        pgutil.TimestampToPtr(monitor.LastCheckInAt),
			LastMissedAt:         pgutil.TimestampToPtr(monitor.LastMissedAt),
			LastRecoveredAt:      pgutil.TimestampToPtr(monitor.LastRecoveredAt),
		}); err != nil {
			service.logger.ErrorContext(ctx, "RecordCheckIn: failed to enqueue clickhouse check-in", "error", err)
		}
	}

	return now, nil
}

type heartbeatDeliveryInput struct {
	AppID                string
	AppName              string
	HeartbeatID          string
	HeartbeatName        string
	Token                string
	ExpectedEverySeconds int
	GraceSeconds         int
	LastCheckInAt        *time.Time
	LastMissedAt         *time.Time
	LastRecoveredAt      *time.Time
}

func (service *service) insertRecoveryDeliveries(ctx context.Context, queries *pgdb.Queries, input heartbeatDeliveryInput, now time.Time) error {
	destinationIDs, err := queries.ListHeartbeatMonitorDestinationIDs(ctx, input.HeartbeatID)
	if err != nil {
		return fmt.Errorf("postgres: query heartbeat destinations: %w", err)
	}
	if len(destinationIDs) == 0 {
		return nil
	}

	payload, err := json.Marshal(map[string]any{
		"type":      "heartbeat.recovered",
		"timestamp": now.Format(time.RFC3339),
		"app": map[string]any{
			"id":   input.AppID,
			"name": input.AppName,
		},
		"heartbeat": map[string]any{
			"id":                   input.HeartbeatID,
			"name":                 input.HeartbeatName,
			"expectedEverySeconds": input.ExpectedEverySeconds,
			"graceSeconds":         input.GraceSeconds,
			"lastCheckInAt":        formatOptionalTime(input.LastCheckInAt),
			"lastMissedAt":         formatOptionalTime(input.LastMissedAt),
			"lastRecoveredAt":      formatOptionalTime(input.LastRecoveredAt),
			"pingUrl":              fmt.Sprintf("https://ingest.orvo.sh/v1/heartbeats/%s", input.Token),
		},
	})
	if err != nil {
		return fmt.Errorf("json: marshal heartbeat recovery payload: %w", err)
	}

	for _, destinationID := range destinationIDs {
		if err := queries.InsertNotificationDelivery(ctx, pgdb.InsertNotificationDeliveryParams{
			ID:            util.GenerateID("ntdl"),
			AppID:         input.AppID,
			DestinationID: destinationID,
			SourceID:      input.HeartbeatID,
			EventType:     pgdb.NotificationEventTypeHeartbeatrecovered,
			Payload:       payload,
			NextAttemptAt: pgutil.Timestamp(now),
		}); err != nil {
			return fmt.Errorf("postgres: insert recovery delivery: %w", err)
		}
	}

	return nil
}

func formatOptionalTime(value *time.Time) any {
	if value == nil || value.IsZero() {
		return nil
	}
	return value.UTC().Format(time.RFC3339)
}
