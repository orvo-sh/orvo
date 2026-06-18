package models

import "time"

type HeartbeatCheckIn struct {
	AppID                string
	HeartbeatMonitorID   string
	HeartbeatName        string
	CheckedInAt          time.Time
	PreviousStatus       string
	Recovered            bool
	ExpectedEverySeconds int
	GraceSeconds         int
	LastCheckInAt        *time.Time
	LastMissedAt         *time.Time
	LastRecoveredAt      *time.Time
}
