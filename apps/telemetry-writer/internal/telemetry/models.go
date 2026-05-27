package telemetry

import "time"

type MessageMeta struct {
	Version         string    `json:"version"`
	Signal          string    `json:"signal"`
	OrganizationID  string    `json:"organization_id"`
	IngestionKeyID  string    `json:"ingestion_key_id"`
	ReceivedAt      time.Time `json:"received_at"`
	ContentType     string    `json:"content_type"`
	ContentEncoding string    `json:"content_encoding,omitempty"`
	RemoteAddr      string    `json:"remote_addr,omitempty"`
	UserAgent       string    `json:"user_agent,omitempty"`
}

type LogRecord struct {
	Timestamp             time.Time         `json:"timestamp"`
	ObservedTimestamp     time.Time         `json:"observed_timestamp"`
	SeverityNumber        uint8             `json:"severity_number"`
	SeverityText          string            `json:"severity_text"`
	Body                  string            `json:"body"`
	TraceID               string            `json:"trace_id"`
	SpanID                string            `json:"span_id"`
	TraceFlags            uint32            `json:"trace_flags"`
	ResourceAttributes    map[string]string `json:"resource_attributes"`
	ResourceSchemaURL     string            `json:"resource_schema_url"`
	ScopeName             string            `json:"scope_name"`
	ScopeVersion          string            `json:"scope_version"`
	ScopeAttributes       map[string]string `json:"scope_attributes"`
	ScopeSchemaURL        string            `json:"scope_schema_url"`
	LogAttributes         map[string]string `json:"log_attributes"`
	ServiceName           string            `json:"service_name"`
	DeploymentEnvironment string            `json:"deployment_environment"`
}

type LogsMessage struct {
	MessageMeta
	Records []LogRecord `json:"records"`
}

type SpanEvent struct {
	Name       string            `json:"name"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

type SpanLink struct {
	TraceID    string            `json:"trace_id"`
	SpanID     string            `json:"span_id"`
	TraceState string            `json:"trace_state"`
	Attributes map[string]string `json:"attributes"`
}

type Span struct {
	TraceID               string            `json:"trace_id"`
	SpanID                string            `json:"span_id"`
	ParentSpanID          string            `json:"parent_span_id"`
	TraceState            string            `json:"trace_state"`
	Name                  string            `json:"name"`
	Kind                  uint8             `json:"kind"`
	StartTime             time.Time         `json:"start_time"`
	EndTime               time.Time         `json:"end_time"`
	DurationNs            int64             `json:"duration_ns"`
	StatusCode            uint8             `json:"status_code"`
	StatusMessage         string            `json:"status_message"`
	ResourceAttributes    map[string]string `json:"resource_attributes"`
	ScopeAttributes       map[string]string `json:"scope_attributes"`
	SpanAttributes        map[string]string `json:"span_attributes"`
	ResourceSchemaURL     string            `json:"resource_schema_url"`
	ScopeName             string            `json:"scope_name"`
	ScopeVersion          string            `json:"scope_version"`
	ScopeSchemaURL        string            `json:"scope_schema_url"`
	Events                []SpanEvent       `json:"events"`
	Links                 []SpanLink        `json:"links"`
	ServiceName           string            `json:"service_name"`
	DeploymentEnvironment string            `json:"deployment_environment"`
}

type TracesMessage struct {
	MessageMeta
	Spans []Span `json:"spans"`
}

type MetricExemplar struct {
	TraceID   string    `json:"trace_id"`
	SpanID    string    `json:"span_id"`
	Value     float64   `json:"value"`
	Timestamp time.Time `json:"timestamp"`
}

type MetricPoint struct {
	MetricName              string            `json:"metric_name"`
	MetricType              string            `json:"metric_type"`
	MetricUnit              string            `json:"metric_unit"`
	Description             string            `json:"description"`
	ServiceName             string            `json:"service_name"`
	DeploymentEnvironment   string            `json:"deployment_environment"`
	ResourceAttributes      map[string]string `json:"resource_attributes"`
	ScopeName               string            `json:"scope_name"`
	ScopeVersion            string            `json:"scope_version"`
	Attributes              map[string]string `json:"attributes"`
	StartTime               time.Time         `json:"start_time"`
	Time                    time.Time         `json:"time"`
	ValueInt                *int64            `json:"value_int,omitempty"`
	ValueDouble             *float64          `json:"value_double,omitempty"`
	AggregationTemporality  string            `json:"aggregation_temporality,omitempty"`
	IsMonotonic             bool              `json:"is_monotonic"`
	HistogramCount          *uint64           `json:"histogram_count,omitempty"`
	HistogramSum            *float64          `json:"histogram_sum,omitempty"`
	HistogramMin            *float64          `json:"histogram_min,omitempty"`
	HistogramMax            *float64          `json:"histogram_max,omitempty"`
	HistogramBucketCounts   []uint64          `json:"histogram_bucket_counts,omitempty"`
	HistogramExplicitBounds []float64         `json:"histogram_explicit_bounds,omitempty"`
	Exemplars               []MetricExemplar  `json:"exemplars,omitempty"`
	Flags                   uint32            `json:"flags"`
}

type MetricsMessage struct {
	MessageMeta
	Points []MetricPoint `json:"points"`
}

type LogRow struct {
	ID                    string
	OrganizationID        string
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
	ContentType           string
	ContentEncoding       string
	RemoteAddr            string
	UserAgent             string
}

type TraceRow struct {
	ID                    string
	OrganizationID        string
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
	ContentType           string
	ContentEncoding       string
	RemoteAddr            string
	UserAgent             string
}

type MetricRow struct {
	ID                      string
	OrganizationID          string
	IngestionKeyID          string
	ReceivedAt              time.Time
	ExpiresAt               time.Time
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
	ContentType             string
	ContentEncoding         string
	RemoteAddr              string
	UserAgent               string
}
