package billing

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"

	"github.com/orvo-sh/orvo/apps/ingest/internal/apperrors"
	"github.com/orvo-sh/orvo/apps/ingest/internal/storage/postgres"
)

type Reservation struct {
	OrganizationID string
	Signal         string
	PeriodStart    time.Time
	PeriodEnd      time.Time
	ReservedBytes  int64
}

type billingState struct {
	PlanKey       string
	Status        string
	IncludedBytes int64
	PeriodStart   time.Time
	PeriodEnd     time.Time
}

type usageRow struct {
	ID            string
	UsedBytes     int64
	IncludedBytes int64
	OverageBytes  int64
	Notified70At  sql.NullTime
	Notified85At  sql.NullTime
	Notified100At sql.NullTime
}

type Service struct {
	store  *postgres.Client
	logger *slog.Logger
}

func New(store *postgres.Client, logger *slog.Logger) *Service {
	return &Service{
		store:  store,
		logger: logger.With(slog.String("component", "BillingService")),
	}
}

func (service *Service) ReserveSignalUsage(ctx context.Context, organizationID string, signal string, bytes int) (*Reservation, apperrors.AppError) {
	service.logger.InfoContext(ctx, "ReserveSignalUsage: reserving usage",
		slog.String("organization_id", organizationID),
		slog.String("signal", signal),
		slog.Int("bytes", bytes),
	)

	if organizationID == "" {
		return nil, apperrors.ErrBillingRequired
	}

	if bytes <= 0 {
		return &Reservation{
			OrganizationID: organizationID,
			Signal:         signal,
		}, nil
	}

	state, err := service.getBillingState(ctx, organizationID, signal)
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to load billing state", slog.Any("error", err))
		return nil, apperrors.ErrInternal
	}

	if state == nil || !statusHasAccess(state.Status) {
		return nil, apperrors.ErrBillingRequired
	}

	tx, err := service.store.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to begin transaction", slog.Any("error", err))
		return nil, apperrors.ErrInternal
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	row, err := service.ensureUsageRow(ctx, tx, organizationID, signal, *state)
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to ensure usage row", slog.Any("error", err))
		return nil, apperrors.ErrInternal
	}

	previousUsedBytes := row.UsedBytes
	newUsedBytes := previousUsedBytes + int64(bytes)
	if state.PlanKey == "starter" && newUsedBytes > row.IncludedBytes {
		return nil, apperrors.ErrBillingQuotaExceeded
	}

	newOverageBytes := maxInt64(newUsedBytes-row.IncludedBytes, 0)
	now := time.Now().UTC()
	notificationRows := make([]queuedNotification, 0, 3)

	notified70At := row.Notified70At
	notified85At := row.Notified85At
	notified100At := row.Notified100At

	for _, threshold := range []int{70, 85, 100} {
		if !crossedThreshold(previousUsedBytes, newUsedBytes, row.IncludedBytes, threshold) {
			continue
		}

		switch threshold {
		case 70:
			if notified70At.Valid {
				continue
			}
			notified70At = sql.NullTime{Time: now, Valid: true}
		case 85:
			if notified85At.Valid {
				continue
			}
			notified85At = sql.NullTime{Time: now, Valid: true}
		case 100:
			if notified100At.Valid {
				continue
			}
			notified100At = sql.NullTime{Time: now, Valid: true}
		}

		notificationRows = append(notificationRows, queuedNotification{
			Kind: "usage_threshold",
			Payload: map[string]any{
				"signal":        signal,
				"threshold":     threshold,
				"plan":          state.PlanKey,
				"usedBytes":     newUsedBytes,
				"includedBytes": row.IncludedBytes,
				"overageBytes":  newOverageBytes,
				"periodStart":   state.PeriodStart.Format(time.RFC3339),
				"periodEnd":     state.PeriodEnd.Format(time.RFC3339),
			},
		})
	}

	if _, err := tx.Exec(
		ctx,
		`
UPDATE organization_billing_usage
SET used_bytes = $5,
    included_bytes = $6,
    overage_bytes = $7,
    notified_70_at = $8,
    notified_85_at = $9,
    notified_100_at = $10,
    updated_at = NOW()
WHERE id = $1
  AND organization_id = $2
  AND signal = $3
  AND period_start = $4
`,
		row.ID,
		organizationID,
		signal,
		state.PeriodStart,
		newUsedBytes,
		row.IncludedBytes,
		newOverageBytes,
		nullTimeValue(notified70At),
		nullTimeValue(notified85At),
		nullTimeValue(notified100At),
	); err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to update usage row", slog.Any("error", err))
		return nil, apperrors.ErrInternal
	}

	if err := service.insertNotifications(ctx, tx, organizationID, notificationRows); err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to queue threshold notifications", slog.Any("error", err))
		return nil, apperrors.ErrInternal
	}

	if err := tx.Commit(ctx); err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to commit usage reservation", slog.Any("error", err))
		return nil, apperrors.ErrInternal
	}

	return &Reservation{
		OrganizationID: organizationID,
		Signal:         signal,
		PeriodStart:    state.PeriodStart,
		PeriodEnd:      state.PeriodEnd,
		ReservedBytes:  int64(bytes),
	}, nil
}

func (service *Service) ReleaseSignalUsage(ctx context.Context, reservation *Reservation) error {
	if reservation == nil || reservation.ReservedBytes <= 0 || reservation.OrganizationID == "" || reservation.Signal == "" {
		return nil
	}

	service.logger.InfoContext(ctx, "ReleaseSignalUsage: releasing usage",
		slog.String("organization_id", reservation.OrganizationID),
		slog.String("signal", reservation.Signal),
		slog.Int64("bytes", reservation.ReservedBytes),
	)

	if _, err := service.store.Pool().Exec(
		ctx,
		`
UPDATE organization_billing_usage
SET used_bytes = GREATEST(used_bytes - $5, 0),
    overage_bytes = GREATEST((used_bytes - $5) - included_bytes, 0),
    updated_at = NOW()
WHERE organization_id = $1
  AND signal = $2
  AND period_start = $3
  AND period_end = $4
`,
		reservation.OrganizationID,
		reservation.Signal,
		reservation.PeriodStart,
		reservation.PeriodEnd,
		reservation.ReservedBytes,
	); err != nil {
		return fmt.Errorf("postgres: release signal usage: %w", err)
	}

	return nil
}

func (service *Service) getBillingState(ctx context.Context, organizationID string, signal string) (*billingState, error) {
	const query = `
SELECT
  COALESCE(entitlements.plan_key, 'none'),
  COALESCE(current_subscription.status, 'inactive'),
  CASE
    WHEN $2 = 'logs' THEN COALESCE(entitlements.logs_max_ingest_bytes_per_period, 0)
    WHEN $2 = 'traces' THEN COALESCE(entitlements.traces_max_ingest_bytes_per_period, 0)
    WHEN $2 = 'metrics' THEN COALESCE(entitlements.metrics_max_ingest_bytes_per_period, 0)
    ELSE 0
  END,
  current_subscription.period_start,
  current_subscription.period_end
FROM entitlements
LEFT JOIN LATERAL (
  SELECT plan, status, period_start, period_end
  FROM subscription
  WHERE reference_id = $1
  ORDER BY
    CASE status
      WHEN 'active' THEN 0
      WHEN 'trialing' THEN 1
      WHEN 'paused' THEN 2
      WHEN 'past_due' THEN 3
      WHEN 'unpaid' THEN 4
      WHEN 'incomplete' THEN 5
      ELSE 6
    END,
    period_end DESC
  LIMIT 1
) AS current_subscription ON TRUE
WHERE entitlements.organization_id = $1
`

	state := &billingState{}
	var includedBytes sql.NullInt64
	var periodStart sql.NullTime
	var periodEnd sql.NullTime

	err := service.store.Pool().QueryRow(ctx, query, organizationID, signal).Scan(
		&state.PlanKey,
		&state.Status,
		&includedBytes,
		&periodStart,
		&periodEnd,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}

		return nil, fmt.Errorf("postgres: load billing state: %w", err)
	}

	if includedBytes.Valid {
		state.IncludedBytes = includedBytes.Int64
	}
	if periodStart.Valid {
		state.PeriodStart = periodStart.Time
	}
	if periodEnd.Valid {
		state.PeriodEnd = periodEnd.Time
	}

	return state, nil
}

func (service *Service) ensureUsageRow(ctx context.Context, tx pgx.Tx, organizationID string, signal string, state billingState) (*usageRow, error) {
	const insertQuery = `
INSERT INTO organization_billing_usage (
  id,
  organization_id,
  signal,
  period_start,
  period_end,
  used_bytes,
  included_bytes,
  overage_bytes
)
VALUES ($1, $2, $3, $4, $5, 0, $6, 0)
ON CONFLICT (organization_id, signal, period_start, period_end) DO NOTHING
`
	if _, err := tx.Exec(ctx, insertQuery, generateID("busg"), organizationID, signal, state.PeriodStart, state.PeriodEnd, state.IncludedBytes); err != nil {
		return nil, fmt.Errorf("postgres: insert usage row: %w", err)
	}

	const selectQuery = `
SELECT id, used_bytes, included_bytes, overage_bytes, notified_70_at, notified_85_at, notified_100_at
FROM organization_billing_usage
WHERE organization_id = $1
  AND signal = $2
  AND period_start = $3
  AND period_end = $4
FOR UPDATE
`

	row := &usageRow{}
	if err := tx.QueryRow(ctx, selectQuery, organizationID, signal, state.PeriodStart, state.PeriodEnd).Scan(
		&row.ID,
		&row.UsedBytes,
		&row.IncludedBytes,
		&row.OverageBytes,
		&row.Notified70At,
		&row.Notified85At,
		&row.Notified100At,
	); err != nil {
		return nil, fmt.Errorf("postgres: select usage row: %w", err)
	}

	return row, nil
}

type queuedNotification struct {
	Kind    string
	Payload map[string]any
}

func (service *Service) insertNotifications(ctx context.Context, tx pgx.Tx, organizationID string, notifications []queuedNotification) error {
	for _, notification := range notifications {
		payload, err := json.Marshal(notification.Payload)
		if err != nil {
			return fmt.Errorf("marshal billing notification payload: %w", err)
		}

		if _, err := tx.Exec(
			ctx,
			`
INSERT INTO organization_billing_notification (
  id,
  organization_id,
  kind,
  status,
  payload,
  attempt_count,
  next_attempt_at
)
VALUES ($1, $2, $3, 'pending', $4, 0, NOW())
`,
			generateID("bntf"),
			organizationID,
			notification.Kind,
			string(payload),
		); err != nil {
			return fmt.Errorf("insert billing notification: %w", err)
		}
	}

	return nil
}

func statusHasAccess(status string) bool {
	switch status {
	case "active", "trialing":
		return true
	default:
		return false
	}
}

func crossedThreshold(previousUsedBytes int64, newUsedBytes int64, includedBytes int64, threshold int) bool {
	if includedBytes <= 0 {
		return false
	}

	thresholdBytes := (includedBytes * int64(threshold)) / 100
	return previousUsedBytes < thresholdBytes && newUsedBytes >= thresholdBytes
}

func nullTimeValue(value sql.NullTime) any {
	if !value.Valid {
		return nil
	}

	return value.Time
}

func generateID(prefix string) string {
	if prefix == "" {
		return strings.ToLower(ulid.Make().String())
	}

	return strings.ToLower(prefix + "_" + ulid.Make().String())
}

func maxInt64(left int64, right int64) int64 {
	if left > right {
		return left
	}

	return right
}
