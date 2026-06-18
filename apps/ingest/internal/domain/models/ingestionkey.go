package models

import "time"

type IngestionKey struct {
	ID             string
	OrganizationID string
	AppID          string
	Key            string
	Kind           string
	LastUsedAt     *time.Time
	CreatedAt      time.Time
	RevokedAt      *time.Time
}

type ResolvedIngestionKey struct {
	OrganizationID string
	AppID          string
	IngestionKeyID string
	Kind           string
}
