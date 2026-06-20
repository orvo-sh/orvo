package models

import "time"

type HeartbeatCheckIn struct {
	AppID              string
	HeartbeatMonitorID string
	CheckedInAt        time.Time
}
