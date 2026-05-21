package ingest

import "time"

type APIKey struct {
	ID             string
	OrganizationID string
	KeyHash        string
	Name           string
	ExpiresAt      *time.Time
	LastUsedAt     *time.Time
	CreatedAt      time.Time
	RevokedAt      *time.Time
}

type ResolvedAPIKey struct {
	OrganizationID string
	APIKeyID       string
}

type MessageMeta struct {
	Version         string    `json:"version"`
	Signal          string    `json:"signal"`
	OrganizationID  string    `json:"organization_id"`
	APIKeyID        string    `json:"api_key_id"`
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

type MetricType int8

const (
	MetricTypeSum MetricType = iota + 1
	MetricTypeGauge
	MetricTypeHistogram
)

func (metricType MetricType) String() string {
	switch metricType {
	case MetricTypeSum:
		return "sum"
	case MetricTypeGauge:
		return "gauge"
	case MetricTypeHistogram:
		return "histogram"
	default:
		return "unknown"
	}
}

type AggregationTemporality int8

const (
	AggTemporalityUnspecified AggregationTemporality = 0
	AggTemporalityDelta       AggregationTemporality = 1
	AggTemporalityCumulative  AggregationTemporality = 2
)

func (temporality AggregationTemporality) String() string {
	switch temporality {
	case AggTemporalityDelta:
		return "delta"
	case AggTemporalityCumulative:
		return "cumulative"
	default:
		return "unspecified"
	}
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
