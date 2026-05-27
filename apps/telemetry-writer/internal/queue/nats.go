package queue

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/config"
)

const (
	TelemetryStreamName     = "TELEMETRY_V1"
	TelemetryLogsSubject    = "telemetry.logs.v1"
	TelemetryTracesSubject  = "telemetry.traces.v1"
	TelemetryMetricsSubject = "telemetry.metrics.v1"
)

type Client struct {
	conn   *nats.Conn
	stream jetstream.Stream
	logger *slog.Logger
	config config.NatsConfig
}

func New(ctx context.Context, logger *slog.Logger, cfg config.NatsConfig) (*Client, error) {
	conn, err := nats.Connect(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("nats: connect: %w", err)
	}

	js, err := jetstream.New(conn)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("nats: create jetstream client: %w", err)
	}

	stream, err := js.Stream(ctx, TelemetryStreamName)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("nats: get stream %s: %w", TelemetryStreamName, err)
	}

	return &Client{
		conn:   conn,
		stream: stream,
		logger: logger,
		config: cfg,
	}, nil
}

func (client *Client) CreateConsumer(ctx context.Context, durable string, subject string) (jetstream.Consumer, error) {
	return client.stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:       durable,
		Name:          durable,
		FilterSubject: subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		AckWait:       client.config.AckWait,
		MaxAckPending: client.config.MaxAckPending,
	})
}

func (client *Client) Close() {
	client.conn.Close()
}
