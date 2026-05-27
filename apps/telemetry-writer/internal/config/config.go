package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

const (
	ServiceName = "orvo-telemetry-writer"

	DefaultEnvironment = "development"

	DefaultNATSURL = "nats://127.0.0.1:4222"

	DefaultEntitlementsCacheTTL = 5 * time.Minute
	DefaultFetchMaxWait         = 250 * time.Millisecond
	DefaultFlushInterval        = 1 * time.Second
	DefaultAckWait              = 2 * time.Minute
	DefaultMaxAckPending        = 2048
	DefaultPullMaxMessages      = 128
	DefaultShutdownFlushTimeout = 10 * time.Second

	DefaultLogsBatchSize     = 5000
	DefaultLogsBatchBytes    = 8 * 1024 * 1024
	DefaultTracesBatchSize   = 2000
	DefaultTracesBatchBytes  = 8 * 1024 * 1024
	DefaultMetricsBatchSize  = 10000
	DefaultMetricsBatchBytes = 4 * 1024 * 1024

	DefaultLogsRetentionDays    = 30
	DefaultTracesRetentionDays  = 14
	DefaultMetricsRetentionDays = 90
)

type Config struct {
	App        AppConfig        `envPrefix:"APP_"`
	Postgres   PostgresConfig   `envPrefix:"POSTGRES_"`
	Nats       NatsConfig       `envPrefix:"NATS_"`
	ClickHouse ClickHouseConfig `envPrefix:"CLICKHOUSE_"`
	Writer     WriterConfig     `envPrefix:"WRITER_"`
}

type AppConfig struct {
	Environment string `env:"ENVIRONMENT"`
}

type PostgresConfig struct {
	URL string `env:"URL"`
}

type NatsConfig struct {
	URL           string        `env:"URL"`
	AckWait       time.Duration `env:"ACK_WAIT"`
	MaxAckPending int           `env:"MAX_ACK_PENDING"`
}

type ClickHouseConfig struct {
	URL string `env:"URL"`
}

type WriterConfig struct {
	EntitlementsCacheTTL time.Duration `env:"ENTITLEMENTS_CACHE_TTL"`
	FetchMaxWait         time.Duration `env:"FETCH_MAX_WAIT"`
	FlushInterval        time.Duration `env:"FLUSH_INTERVAL"`
	PullMaxMessages      int           `env:"PULL_MAX_MESSAGES"`
	ShutdownFlushTimeout time.Duration `env:"SHUTDOWN_FLUSH_TIMEOUT"`
	LogsBatchSize        int           `env:"LOGS_BATCH_SIZE"`
	LogsBatchBytes       int           `env:"LOGS_BATCH_BYTES"`
	TracesBatchSize      int           `env:"TRACES_BATCH_SIZE"`
	TracesBatchBytes     int           `env:"TRACES_BATCH_BYTES"`
	MetricsBatchSize     int           `env:"METRICS_BATCH_SIZE"`
	MetricsBatchBytes    int           `env:"METRICS_BATCH_BYTES"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse environment variables: %w", err)
	}

	cfg.applyDefaults()

	if cfg.Postgres.URL == "" {
		return nil, fmt.Errorf("missing POSTGRES_URL")
	}
	if cfg.ClickHouse.URL == "" {
		return nil, fmt.Errorf("missing CLICKHOUSE_URL")
	}

	return &cfg, nil
}

func (cfg *Config) applyDefaults() {
	if cfg.App.Environment == "" {
		cfg.App.Environment = DefaultEnvironment
	}
	if cfg.Nats.URL == "" {
		cfg.Nats.URL = DefaultNATSURL
	}
	if cfg.Nats.AckWait == 0 {
		cfg.Nats.AckWait = DefaultAckWait
	}
	if cfg.Nats.MaxAckPending == 0 {
		cfg.Nats.MaxAckPending = DefaultMaxAckPending
	}
	if cfg.Writer.EntitlementsCacheTTL == 0 {
		cfg.Writer.EntitlementsCacheTTL = DefaultEntitlementsCacheTTL
	}
	if cfg.Writer.FetchMaxWait == 0 {
		cfg.Writer.FetchMaxWait = DefaultFetchMaxWait
	}
	if cfg.Writer.FlushInterval == 0 {
		cfg.Writer.FlushInterval = DefaultFlushInterval
	}
	if cfg.Writer.PullMaxMessages == 0 {
		cfg.Writer.PullMaxMessages = DefaultPullMaxMessages
	}
	if cfg.Writer.ShutdownFlushTimeout == 0 {
		cfg.Writer.ShutdownFlushTimeout = DefaultShutdownFlushTimeout
	}
	if cfg.Writer.LogsBatchSize == 0 {
		cfg.Writer.LogsBatchSize = DefaultLogsBatchSize
	}
	if cfg.Writer.LogsBatchBytes == 0 {
		cfg.Writer.LogsBatchBytes = DefaultLogsBatchBytes
	}
	if cfg.Writer.TracesBatchSize == 0 {
		cfg.Writer.TracesBatchSize = DefaultTracesBatchSize
	}
	if cfg.Writer.TracesBatchBytes == 0 {
		cfg.Writer.TracesBatchBytes = DefaultTracesBatchBytes
	}
	if cfg.Writer.MetricsBatchSize == 0 {
		cfg.Writer.MetricsBatchSize = DefaultMetricsBatchSize
	}
	if cfg.Writer.MetricsBatchBytes == 0 {
		cfg.Writer.MetricsBatchBytes = DefaultMetricsBatchBytes
	}
}
