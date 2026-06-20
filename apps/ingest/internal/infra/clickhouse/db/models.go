package chdb

import "time"

type LogsRaw struct {
	ID                    string
	AppID                 string
	IngestionKeyID        string
	ReceivedAt            time.Time
	ExpiresAt             time.Time
	Timestamp             time.Time
	ObservedTimestamp     time.Time
	SeverityNumber        uint8
	SeverityText          string
	Body                  string
	TraceID               string
	SpanID                string
	TraceFlags            uint32
	ResourceAttributes    map[string]string
	ResourceSchemaURL     string
	ScopeName             string
	ScopeVersion          string
	ScopeAttributes       map[string]string
	ScopeSchemaURL        string
	LogAttributes         map[string]string
	ServiceName           string
	DeploymentEnvironment string
}

type TracesRaw struct {
	ID                    string
	AppID                 string
	IngestionKeyID        string
	ReceivedAt            time.Time
	ExpiresAt             time.Time
	TraceID               string
	SpanID                string
	ParentSpanID          string
	TraceState            string
	Name                  string
	Kind                  uint8
	StartTime             time.Time
	EndTime               time.Time
	DurationNs            int64
	StatusCode            uint8
	StatusMessage         string
	ResourceAttributes    map[string]string
	ScopeAttributes       map[string]string
	SpanAttributes        map[string]string
	ResourceSchemaURL     string
	ScopeName             string
	ScopeVersion          string
	ScopeSchemaURL        string
	EventsJSON            string
	LinksJSON             string
	ServiceName           string
	DeploymentEnvironment string
}

type MetricsRaw struct {
	ID                      string
	AppID                   string
	IngestionKeyID          string
	ReceivedAt              time.Time
	ExpiresAt               time.Time
	EntityKind              string
	HostID                  string
	HostName                string
	HostArch                string
	OSType                  string
	ContainerID             string
	ContainerName           string
	ContainerImageName      string
	MetricName              string
	MetricType              string
	MetricUnit              string
	Description             string
	ServiceName             string
	DeploymentEnvironment   string
	ResourceAttributes      map[string]string
	ScopeName               string
	ScopeVersion            string
	Attributes              map[string]string
	StartTime               time.Time
	Time                    time.Time
	ValueInt                *int64
	ValueDouble             *float64
	AggregationTemporality  string
	IsMonotonic             bool
	HistogramCount          *uint64
	HistogramSum            *float64
	HistogramMin            *float64
	HistogramMax            *float64
	HistogramBucketCounts   []uint64
	HistogramExplicitBounds []float64
	ExemplarsJSON           string
	Flags                   uint32
}

type HeartbeatCheckIns struct {
	ID                 string
	AppID              string
	HeartbeatMonitorID string
	CheckedInAt        time.Time
}

type InsertLogsRawParams = LogsRaw
type InsertTracesRawParams = TracesRaw
type InsertMetricsRawParams = MetricsRaw
type InsertHeartbeatCheckInsParams = HeartbeatCheckIns
