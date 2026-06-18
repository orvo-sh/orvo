package pgutil

import (
	"errors"
	"time"

	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func TextFromPtr(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func TextPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func Timestamp(value time.Time) pgtype.Timestamp {
	return pgtype.Timestamp{
		Time:  value.UTC().Truncate(time.Millisecond),
		Valid: true,
	}
}

func TimestampFromPtr(value *time.Time) pgtype.Timestamp {
	if value == nil {
		return pgtype.Timestamp{Valid: false}
	}
	return Timestamp(*value)
}

func TimestampPtr(value pgtype.Timestamp) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}

func TimestampToPtr(value pgtype.Timestamp) *time.Time {
	if !value.Valid {
		return nil
	}
	copy := value.Time
	return &copy
}

func TimestampToTime(value pgtype.Timestamp) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time
}

func JSONB(value []byte) []byte {
	if len(value) == 0 {
		return []byte("{}")
	}
	return value
}

func IsNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

func IsUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	if pgErr.Code != "23505" {
		return false
	}
	if constraint == "" {
		return true
	}
	return pgErr.ConstraintName == constraint
}
