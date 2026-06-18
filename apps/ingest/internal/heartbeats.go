package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type HeartbeatService struct {
	store  *PostgresClient
	logger *slog.Logger
}

func NewHeartbeatService(store *PostgresClient, logger *slog.Logger) *HeartbeatService {
	return &HeartbeatService{
		store:  store,
		logger: logger.With("component", "heartbeats"),
	}
}

func (service *HeartbeatService) handleCheckIn(writer http.ResponseWriter, request *http.Request, secret string) {
	if request.Method != http.MethodGet && request.Method != http.MethodPost {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	receivedAt, appErr := service.recordCheckIn(request.Context(), secret)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	writeJSON(writer, http.StatusAccepted, map[string]any{
		"ok":         true,
		"receivedAt": receivedAt.Format(time.RFC3339),
	})
}

func (service *HeartbeatService) recordCheckIn(ctx context.Context, secret string) (time.Time, AppError) {
	service.logger.InfoContext(ctx, "RecordCheckIn: recording heartbeat check-in")

	tx, err := service.store.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to begin transaction", slog.Any("error", err))
		return time.Time{}, ErrInternal
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	const loadHeartbeatQuery = `
SELECT
  heartbeat_monitor.id,
  heartbeat_monitor.app_id,
  heartbeat_monitor.name,
  heartbeat_monitor.secret_token,
  heartbeat_monitor.expected_every_seconds,
  heartbeat_monitor.grace_seconds,
  heartbeat_monitor.last_check_in_at,
  heartbeat_monitor.last_status,
  heartbeat_monitor.last_missed_at,
  heartbeat_monitor.last_recovered_at,
  app.name
FROM heartbeat_monitor
JOIN app ON app.id = heartbeat_monitor.app_id
WHERE heartbeat_monitor.secret_token = $1
`

	var heartbeatID string
	var appID string
	var heartbeatName string
	var secretToken string
	var expectedEverySeconds int
	var graceSeconds int
	var lastCheckInAt *time.Time
	var lastStatus string
	var lastMissedAt *time.Time
	var lastRecoveredAt *time.Time
	var appName string

	if err := tx.QueryRow(ctx, loadHeartbeatQuery, secret).Scan(
		&heartbeatID,
		&appID,
		&heartbeatName,
		&secretToken,
		&expectedEverySeconds,
		&graceSeconds,
		&lastCheckInAt,
		&lastStatus,
		&lastMissedAt,
		&lastRecoveredAt,
		&appName,
	); err != nil {
		if err == pgx.ErrNoRows {
			return time.Time{}, ErrHeartbeatMonitorNotFound
		}

		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to load heartbeat monitor", slog.Any("error", err))
		return time.Time{}, ErrInternal
	}

	now := time.Now().UTC()

	const updateHeartbeatQuery = `
UPDATE heartbeat_monitor
SET
  last_check_in_at = $2,
  last_status = 'healthy',
  last_recovered_at = CASE WHEN last_status = 'missed' THEN $2 ELSE last_recovered_at END,
  updated_at = $2
WHERE id = $1
`
	if _, err := tx.Exec(ctx, updateHeartbeatQuery, heartbeatID, now); err != nil {
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to update heartbeat monitor", slog.Any("error", err))
		return time.Time{}, ErrInternal
	}

	const markFirstReceivedQuery = `
UPDATE app
SET heartbeats_first_received_at = $2
WHERE id = $1
  AND heartbeats_first_received_at IS NULL
`
	if _, err := tx.Exec(ctx, markFirstReceivedQuery, appID, now); err != nil {
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to update first received timestamp", slog.Any("error", err))
		return time.Time{}, ErrInternal
	}

	if lastStatus == "missed" {
		if err := service.insertRecoveryDeliveries(ctx, tx, heartbeatDeliveryInput{
			AppID:                appID,
			AppName:              appName,
			HeartbeatID:          heartbeatID,
			HeartbeatName:        heartbeatName,
			SecretToken:          secretToken,
			ExpectedEverySeconds: expectedEverySeconds,
			GraceSeconds:         graceSeconds,
			LastCheckInAt:        lastCheckInAt,
			LastMissedAt:         lastMissedAt,
			LastRecoveredAt:      &now,
		}, now); err != nil {
			service.logger.ErrorContext(ctx, "RecordCheckIn: failed to insert recovery deliveries", slog.Any("error", err))
			return time.Time{}, ErrInternal
		}
	}

	if err := tx.Commit(ctx); err != nil {
		service.logger.ErrorContext(ctx, "RecordCheckIn: failed to commit transaction", slog.Any("error", err))
		return time.Time{}, ErrInternal
	}

	return now, nil
}

type heartbeatDeliveryInput struct {
	AppID                string
	AppName              string
	HeartbeatID          string
	HeartbeatName        string
	SecretToken          string
	ExpectedEverySeconds int
	GraceSeconds         int
	LastCheckInAt        *time.Time
	LastMissedAt         *time.Time
	LastRecoveredAt      *time.Time
}

func (service *HeartbeatService) insertRecoveryDeliveries(ctx context.Context, tx pgx.Tx, input heartbeatDeliveryInput, now time.Time) error {
	const destinationsQuery = `
SELECT destination_id
FROM heartbeat_monitor_destination
WHERE heartbeat_monitor_id = $1
`

	rows, err := tx.Query(ctx, destinationsQuery, input.HeartbeatID)
	if err != nil {
		return fmt.Errorf("postgres: query heartbeat destinations: %w", err)
	}
	defer rows.Close()

	destinationIDs := make([]string, 0)
	for rows.Next() {
		var destinationID string
		if err := rows.Scan(&destinationID); err != nil {
			return fmt.Errorf("postgres: scan heartbeat destination: %w", err)
		}
		destinationIDs = append(destinationIDs, destinationID)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("postgres: iterate heartbeat destinations: %w", err)
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
			"pingUrl": fmt.Sprintf(
				"https://ingest.orvo.sh/v1/heartbeats/%s",
				input.SecretToken,
			),
		},
	})
	if err != nil {
		return fmt.Errorf("json: marshal heartbeat recovery payload: %w", err)
	}

	const insertDeliveryQuery = `
INSERT INTO notification_delivery (
  id,
  app_id,
  destination_id,
  source_kind,
  source_id,
  event_type,
  payload,
  status,
  next_attempt_at
)
VALUES ($1, $2, $3, 'heartbeat', $4, 'heartbeat.recovered', $5, 'pending', $6)
`

	for _, destinationID := range destinationIDs {
		if _, err := tx.Exec(
			ctx,
			insertDeliveryQuery,
			GenerateID("ntdl"),
			input.AppID,
			destinationID,
			input.HeartbeatID,
			payload,
			now,
		); err != nil {
			return fmt.Errorf("postgres: insert recovery delivery: %w", err)
		}
	}

	return nil
}

func heartbeatSecretFromPath(path string) (string, error) {
	path = strings.TrimPrefix(path, "/v1/heartbeats/")
	path = strings.Trim(path, "/")
	if path == "" || strings.Contains(path, "/") {
		return "", fmt.Errorf("invalid heartbeat path")
	}

	return path, nil
}

func formatOptionalTime(value *time.Time) any {
	if value == nil {
		return nil
	}

	return value.UTC().Format(time.RFC3339)
}
