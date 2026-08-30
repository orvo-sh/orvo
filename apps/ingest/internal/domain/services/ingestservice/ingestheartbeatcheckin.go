package ingestservice

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) IngestHeartbeatCheckIn(ctx context.Context, token string) (time.Time, apperr.Error) {
	service.logger.InfoContext(ctx, "IngestHeartbeatCheckIn: ingesting heartbeat check-in")

	tx, err := service.postgres.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to begin transaction", "error", err)
		return time.Time{}, errs.ErrInternal
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := service.postgres.WithTx(tx)
	monitor, err := queries.GetHeartbeatMonitorByToken(ctx, token)
	if err != nil {
		if pgutil.IsNoRows(err) {
			return time.Time{}, errs.ErrHeartbeatMonitorNotFound
		}
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to load heartbeat monitor", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	checkedInAt := time.Now().UTC()
	if err := queries.MarkHeartbeatMonitorHealthy(ctx, pgdb.MarkHeartbeatMonitorHealthyParams{
		ID:            monitor.ID,
		LastCheckInAt: pgutil.Timestamp(checkedInAt),
	}); err != nil {
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to update heartbeat monitor", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	incidentID, err := queries.ResolveOpenHeartbeatIncident(ctx, pgdb.ResolveOpenHeartbeatIncidentParams{
		AppID:      monitor.AppID,
		SourceKey:  fmt.Sprintf("heartbeat:%s:missed", monitor.ID),
		ResolvedAt: pgutil.Timestamp(checkedInAt),
	})
	if err != nil && !pgutil.IsNoRows(err) {
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to resolve heartbeat incident", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	if incidentID != "" {
		eventMetadata, marshalErr := json.Marshal(map[string]any{
			"heartbeatMonitorId": monitor.ID,
		})
		if marshalErr != nil {
			service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to marshal incident event metadata", "error", marshalErr)
			return time.Time{}, errs.ErrInternal
		}

		for _, eventType := range []pgdb.IncidentEventType{
			pgdb.IncidentEventTypeHeartbeatrecovered,
			pgdb.IncidentEventTypeIncidentresolved,
		} {
			metadata := eventMetadata
			if eventType == pgdb.IncidentEventTypeIncidentresolved {
				metadata = []byte(`{"automatic":true}`)
			}
			if err := queries.InsertHeartbeatIncidentEvent(ctx, pgdb.InsertHeartbeatIncidentEventParams{
				ID:         util.GenerateID("inev"),
				AppID:      monitor.AppID,
				IncidentID: incidentID,
				EventType:  eventType,
				OccurredAt: pgutil.Timestamp(checkedInAt),
				Metadata:   metadata,
			}); err != nil {
				service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to insert incident recovery event", "error", err)
				return time.Time{}, errs.ErrInternal
			}
		}

		payload, marshalErr := json.Marshal(map[string]any{
			"type":      "heartbeat.recovered",
			"timestamp": checkedInAt.Format(time.RFC3339Nano),
			"app": map[string]any{
				"id":   monitor.AppID,
				"name": monitor.AppName,
			},
			"incident": map[string]any{
				"id":  incidentID,
				"url": strings.TrimRight(service.config.AppBaseURL, "/") + "/a/" + url.PathEscape(monitor.AppID) + "/incidents/" + url.PathEscape(incidentID),
			},
			"heartbeat": map[string]any{
				"id":                   monitor.ID,
				"name":                 monitor.Name,
				"expectedEverySeconds": monitor.ExpectedEverySeconds,
				"graceSeconds":         monitor.GraceSeconds,
				"lastCheckInAt":        checkedInAt.Format(time.RFC3339Nano),
				"status":               "healthy",
				"pingUrl":              strings.TrimRight(service.config.IngestBaseURL, "/") + "/v1/heartbeats/" + url.PathEscape(token),
			},
		})
		if marshalErr != nil {
			service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to marshal recovery notification payload", "error", marshalErr)
			return time.Time{}, errs.ErrInternal
		}

		destinationIDs, err := queries.ListHeartbeatDestinationIDs(ctx, monitor.ID)
		if err != nil {
			service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to load heartbeat destinations", "error", err)
			return time.Time{}, errs.ErrInternal
		}
		for _, destinationID := range destinationIDs {
			if err := queries.InsertHeartbeatRecoveryDelivery(ctx, pgdb.InsertHeartbeatRecoveryDeliveryParams{
				ID:            util.GenerateID("ntdl"),
				AppID:         monitor.AppID,
				DestinationID: destinationID,
				IncidentID:    pgtype.Text{String: incidentID, Valid: true},
				SourceID:      monitor.ID,
				Payload:       payload,
				NextAttemptAt: pgutil.Timestamp(checkedInAt),
			}); err != nil {
				service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to queue recovery notification", "error", err)
				return time.Time{}, errs.ErrInternal
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to commit heartbeat check-in", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	if err := service.enqueueHeartbeatCheckIn(ctx, models.HeartbeatCheckIn{
		AppID:              monitor.AppID,
		HeartbeatMonitorID: monitor.ID,
		CheckedInAt:        checkedInAt,
	}); err != nil {
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to enqueue heartbeat check-in",
			slog.String("app_id", monitor.AppID),
			slog.String("heartbeat_monitor_id", monitor.ID),
			"error", err,
		)
	}

	return checkedInAt, nil
}
