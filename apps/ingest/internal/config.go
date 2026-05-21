package ingest

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	App      AppConfig      `envPrefix:"APP_"`
	Postgres PostgresConfig `envPrefix:"POSTGRES_"`
	Nats     NatsConfig     `envPrefix:"NATS_"`
	Otel     OtelConfig     `envPrefix:"OTEL_"`
	Ingest   IngestConfig   `envPrefix:"INGEST_"`
}

type AppConfig struct {
	ServiceName     string        `env:"SERVICE_NAME" envDefault:"orvo-ingest"`
	Environment     string        `env:"ENVIRONMENT" envDefault:"development"`
	ShutdownTimeout time.Duration `env:"SHUTDOWN_TIMEOUT" envDefault:"15s"`
}

type PostgresConfig struct {
	URL string `env:"URL"`
}

type NatsConfig struct {
	URL            string        `env:"URL" envDefault:"nats://127.0.0.1:4222"`
	StreamName     string        `env:"STREAM_NAME" envDefault:"TELEMETRY_V1"`
	LogsSubject    string        `env:"LOGS_SUBJECT" envDefault:"telemetry.logs.v1"`
	TracesSubject  string        `env:"TRACES_SUBJECT" envDefault:"telemetry.traces.v1"`
	MetricsSubject string        `env:"METRICS_SUBJECT" envDefault:"telemetry.metrics.v1"`
	PublishTimeout time.Duration `env:"PUBLISH_TIMEOUT" envDefault:"5s"`
}

type OtelConfig struct {
	Endpoint string `env:"ENDPOINT"`
	APIKey   string `env:"API_KEY"`
	Insecure bool   `env:"INSECURE" envDefault:"false"`
}

type IngestConfig struct {
	HTTPHost       string        `env:"HTTP_HOST" envDefault:"0.0.0.0"`
	HTTPPort       string        `env:"HTTP_PORT" envDefault:"4318"`
	MaxBodyBytes   int64         `env:"MAX_BODY_BYTES" envDefault:"10485760"`
	ApiKeyCacheTTL time.Duration `env:"API_KEY_CACHE_TTL" envDefault:"5m"`
	ReadTimeout    time.Duration `env:"READ_TIMEOUT" envDefault:"15s"`
	WriteTimeout   time.Duration `env:"WRITE_TIMEOUT" envDefault:"15s"`
	IdleTimeout    time.Duration `env:"IDLE_TIMEOUT" envDefault:"60s"`
}

func LoadConfig() (*Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse environment variables: %w", err)
	}

	return &cfg, nil
}
