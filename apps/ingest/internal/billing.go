package ingest

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
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
	Notified70At  sql.NullTime
	Notified85At  sql.NullTime
	Notified100At sql.NullTime
}

type BillingService struct {
	store  *PostgresClient
	logger *slog.Logger
}

func NewBillingService(store *PostgresClient, logger *slog.Logger) *BillingService {
	return &BillingService{
		store:  store,
		logger: logger.With(slog.String("component", "BillingService")),
	}
}

func (service *BillingService) ReserveSignalUsage(ctx context.Context, organizationID string, signal string, bytes int) (*Reservation, AppError) {
	service.logger.InfoContext(ctx, "ReserveSignalUsage: reserving usage",
		slog.String("organization_id", organizationID),
		slog.String("signal", signal),
		slog.Int("bytes", bytes),
	)

	if organizationID == "" {
		return nil, ErrBillingRequired
	}

	if bytes <= 0 {
		return &Reservation{
			OrganizationID: organizationID,
			Signal:         signal,
		}, nil
	}

	usageColumn, ok := usageColumnForSignal(signal)
	if !ok {
		return nil, ErrBillingRequired
	}

	state, err := service.getBillingState(ctx, organizationID)
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to load billing state", slog.Any("error", err))
		return nil, ErrInternal
	}

	if state == nil || !statusHasAccess(state.Status) {
		return nil, ErrBillingRequired
	}

	tx, err := service.store.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to begin transaction", slog.Any("error", err))
		return nil, ErrInternal
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	row, err := service.ensureUsageRow(ctx, tx, organizationID, signal, *state)
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to ensure usage row", slog.Any("error", err))
		return nil, ErrInternal
	}

	previousUsedBytes := row.UsedBytes
	newUsedBytes := previousUsedBytes + int64(bytes)
	if state.PlanKey == "starter" && newUsedBytes > row.IncludedBytes {
		return nil, ErrBillingQuotaExceeded
	}

	now := time.Now().UTC()

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
	}

	if _, err := tx.Exec(
		ctx,
		fmt.Sprintf(`
UPDATE organization_usage
SET %s = $3,
    ingest_limit_bytes = $4,
    notified_70_at = $5,
    notified_85_at = $6,
    notified_100_at = $7,
    updated_at = NOW()
WHERE id = $1
  AND organization_id = $2
`, usageColumn),
		row.ID,
		organizationID,
		newUsedBytes,
		row.IncludedBytes,
		nullTimeValue(notified70At),
		nullTimeValue(notified85At),
		nullTimeValue(notified100At),
	); err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to update usage row", slog.Any("error", err))
		return nil, ErrInternal
	}

	if err := tx.Commit(ctx); err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to commit usage reservation", slog.Any("error", err))
		return nil, ErrInternal
	}

	return &Reservation{
		OrganizationID: organizationID,
		Signal:         signal,
		PeriodStart:    state.PeriodStart,
		PeriodEnd:      state.PeriodEnd,
		ReservedBytes:  int64(bytes),
	}, nil
}

func (service *BillingService) ReleaseSignalUsage(ctx context.Context, reservation *Reservation) error {
	if reservation == nil || reservation.ReservedBytes <= 0 || reservation.OrganizationID == "" || reservation.Signal == "" {
		return nil
	}

	service.logger.InfoContext(ctx, "ReleaseSignalUsage: releasing usage",
		slog.String("organization_id", reservation.OrganizationID),
		slog.String("signal", reservation.Signal),
		slog.Int64("bytes", reservation.ReservedBytes),
	)

	usageColumn, ok := usageColumnForSignal(reservation.Signal)
	if !ok {
		return nil
	}

	if _, err := service.store.Pool().Exec(
		ctx,
		fmt.Sprintf(`
UPDATE organization_usage
SET %s = GREATEST(%s - $2, 0),
    updated_at = NOW()
WHERE organization_id = $1
`, usageColumn, usageColumn),
		reservation.OrganizationID,
		reservation.ReservedBytes,
	); err != nil {
		return fmt.Errorf("postgres: release signal usage: %w", err)
	}

	return nil
}

func (service *BillingService) getBillingState(ctx context.Context, organizationID string) (*billingState, error) {
	const query = `
SELECT
  COALESCE(organization.billing_plan::text, current_subscription.plan, 'none'),
  COALESCE(organization.billing_status::text, current_subscription.status, 'inactive'),
  COALESCE(organization_usage.ingest_limit_bytes, 0),
  COALESCE(organization_usage.current_period_start, current_subscription.period_start),
  COALESCE(organization_usage.current_period_end, current_subscription.period_end)
FROM organization
LEFT JOIN organization_usage ON organization_usage.organization_id = organization.id
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
WHERE organization.id = $1
`

	state := &billingState{}
	var includedBytes sql.NullInt64
	var periodStart sql.NullTime
	var periodEnd sql.NullTime

	err := service.store.Pool().QueryRow(ctx, query, organizationID).Scan(
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
	if state.PeriodStart.IsZero() {
		state.PeriodStart = time.Now().UTC()
	}
	if state.PeriodEnd.IsZero() {
		state.PeriodEnd = state.PeriodStart.AddDate(0, 0, 30)
	}

	return state, nil
}

func (service *BillingService) ensureUsageRow(ctx context.Context, tx pgx.Tx, organizationID string, signal string, state billingState) (*usageRow, error) {
	const insertQuery = `
INSERT INTO organization_usage (
  id,
  organization_id,
  logs_retention_days,
  traces_retention_days,
  metrics_retention_days,
  current_period_start,
  current_period_end,
  ingest_limit_bytes
)
VALUES ($1, $2, 30, 30, 30, $3, $4, $5)
ON CONFLICT (organization_id) DO NOTHING
`
	if _, err := tx.Exec(ctx, insertQuery, GenerateID("orgu"), organizationID, state.PeriodStart, state.PeriodEnd, state.IncludedBytes); err != nil {
		return nil, fmt.Errorf("postgres: insert usage row: %w", err)
	}

	usageColumn, _ := usageColumnForSignal(signal)
	const selectQuery = `
SELECT id, %s, ingest_limit_bytes, notified_70_at, notified_85_at, notified_100_at
FROM organization_usage
WHERE organization_id = $1
FOR UPDATE
`

	row := &usageRow{}
	if err := tx.QueryRow(ctx, fmt.Sprintf(selectQuery, usageColumn), organizationID).Scan(
		&row.ID,
		&row.UsedBytes,
		&row.IncludedBytes,
		&row.Notified70At,
		&row.Notified85At,
		&row.Notified100At,
	); err != nil {
		return nil, fmt.Errorf("postgres: select usage row: %w", err)
	}

	return row, nil
}

func statusHasAccess(status string) bool {
	switch status {
	case "active", "trialing":
		return true
	default:
		return false
	}
}

func usageColumnForSignal(signal string) (string, bool) {
	switch signal {
	case "logs":
		return "logs_ingested_bytes", true
	case "traces":
		return "traces_ingested_bytes", true
	case "metrics":
		return "metrics_ingested_bytes", true
	default:
		return "", false
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
