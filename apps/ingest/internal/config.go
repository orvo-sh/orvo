package ingest

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

const (
	ServiceName = "orvo-ingest"

	DefaultEnvironment       = "development"
	DefaultShutdownTimeout   = 15 * time.Second
	DefaultBackgroundTimeout = 5 * time.Second

	DefaultNATSURL          = "nats://127.0.0.1:4222"
	TelemetryStreamName     = "TELEMETRY_V1"
	TelemetryLogsSubject    = "telemetry.logs.v1"
	TelemetryTracesSubject  = "telemetry.traces.v1"
	TelemetryMetricsSubject = "telemetry.metrics.v1"
	DefaultPublishTimeout   = 5 * time.Second

	DefaultHTTPHost             = "0.0.0.0"
	DefaultHTTPPort             = "4318"
	DefaultMaxBodyBytes         = 10 * 1024 * 1024
	DefaultIngestionKeyCacheTTL = 5 * time.Minute
	DefaultReadTimeout          = 15 * time.Second
	DefaultWriteTimeout         = 15 * time.Second
	DefaultIdleTimeout          = 60 * time.Second
)

type Config struct {
	App      AppConfig `envPrefix:"APP_"`
	Orvo     OrvoConfig
	Postgres PostgresConfig `envPrefix:"POSTGRES_"`
	Nats     NatsConfig     `envPrefix:"NATS_"`
	Otel     OtelConfig     `envPrefix:"OTEL_"`
	Ingest   IngestConfig   `envPrefix:"INGEST_"`
}

type OrvoConfig struct {
	OTLPBaseURL         string `env:"ORVO_OTLP_BASE_URL"`
	PrivateIngestionKey string `env:"ORVO_PRIVATE_INGESTION_KEY"`
}

type AppConfig struct {
	Environment string `env:"ENVIRONMENT"`
}

type PostgresConfig struct {
	URL string `env:"URL"`
}

type NatsConfig struct {
	URL            string        `env:"URL"`
	PublishTimeout time.Duration `env:"PUBLISH_TIMEOUT"`
}

type OtelConfig struct {
	Endpoint     string `env:"ENDPOINT"`
	IngestionKey string `env:"INGESTION_KEY"`
	Insecure     bool   `env:"INSECURE"`
}

type IngestConfig struct {
	HTTPHost             string        `env:"HTTP_HOST"`
	HTTPPort             string        `env:"HTTP_PORT"`
	MaxBodyBytes         int64         `env:"MAX_BODY_BYTES"`
	IngestionKeyCacheTTL time.Duration `env:"INGESTION_KEY_CACHE_TTL"`
	ReadTimeout          time.Duration `env:"READ_TIMEOUT"`
	WriteTimeout         time.Duration `env:"WRITE_TIMEOUT"`
	IdleTimeout          time.Duration `env:"IDLE_TIMEOUT"`
}

func LoadConfig() (*Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse environment variables: %w", err)
	}

	cfg.applyDefaults()
	return &cfg, nil
}

func (cfg *Config) applyDefaults() {
	if cfg.App.Environment == "" {
		cfg.App.Environment = DefaultEnvironment
	}
	if cfg.Otel.Endpoint == "" {
		cfg.Otel.Endpoint = cfg.Orvo.OTLPBaseURL
	}
	if cfg.Otel.IngestionKey == "" {
		cfg.Otel.IngestionKey = cfg.Orvo.PrivateIngestionKey
	}
	if cfg.Nats.URL == "" {
		cfg.Nats.URL = DefaultNATSURL
	}
	if cfg.Nats.PublishTimeout == 0 {
		cfg.Nats.PublishTimeout = DefaultPublishTimeout
	}
	if cfg.Ingest.HTTPHost == "" {
		cfg.Ingest.HTTPHost = DefaultHTTPHost
	}
	if cfg.Ingest.HTTPPort == "" {
		cfg.Ingest.HTTPPort = DefaultHTTPPort
	}
	if cfg.Ingest.MaxBodyBytes == 0 {
		cfg.Ingest.MaxBodyBytes = DefaultMaxBodyBytes
	}
	if cfg.Ingest.IngestionKeyCacheTTL == 0 {
		cfg.Ingest.IngestionKeyCacheTTL = DefaultIngestionKeyCacheTTL
	}
	if cfg.Ingest.ReadTimeout == 0 {
		cfg.Ingest.ReadTimeout = DefaultReadTimeout
	}
	if cfg.Ingest.WriteTimeout == 0 {
		cfg.Ingest.WriteTimeout = DefaultWriteTimeout
	}
	if cfg.Ingest.IdleTimeout == 0 {
		cfg.Ingest.IdleTimeout = DefaultIdleTimeout
	}
}
