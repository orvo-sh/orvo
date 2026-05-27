package writer

import (
	"testing"
	"time"
)

func TestComputeExpiresAtUsesSignalRetention(t *testing.T) {
	eventTime := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	entitlement := Entitlement{
		LogsRetentionDays:    30,
		TracesRetentionDays:  14,
		MetricsRetentionDays: 90,
	}

	if got := ComputeExpiresAt("logs", eventTime, entitlement); !got.Equal(eventTime.Add(30 * 24 * time.Hour)) {
		t.Fatalf("expected logs expiry in 30 days, got %s", got)
	}
	if got := ComputeExpiresAt("traces", eventTime, entitlement); !got.Equal(eventTime.Add(14 * 24 * time.Hour)) {
		t.Fatalf("expected traces expiry in 14 days, got %s", got)
	}
	if got := ComputeExpiresAt("metrics", eventTime, entitlement); !got.Equal(eventTime.Add(90 * 24 * time.Hour)) {
		t.Fatalf("expected metrics expiry in 90 days, got %s", got)
	}
}
