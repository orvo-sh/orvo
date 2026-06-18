package models

import "time"

type MessageMeta struct {
	Version        string
	Signal         string
	AppID          string
	IngestionKeyID string
	ReceivedAt     time.Time
}

type LogRecord struct {
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

type LogsMessage struct {
	MessageMeta
	Records []LogRecord
}

type SpanEvent struct {
	Name       string
	Timestamp  time.Time
	Attributes map[string]string
}

type SpanLink struct {
	TraceID    string
	SpanID     string
	TraceState string
	Attributes map[string]string
}

type Span struct {
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
	Events                []SpanEvent
	Links                 []SpanLink
	ServiceName           string
	DeploymentEnvironment string
}

type TracesMessage struct {
	MessageMeta
	Spans []Span
}

type MetricExemplar struct {
	TraceID   string
	SpanID    string
	Value     float64
	Timestamp time.Time
}

type MetricPoint struct {
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
	Exemplars               []MetricExemplar
	Flags                   uint32
}

type MetricsMessage struct {
	MessageMeta
	Points []MetricPoint
}
