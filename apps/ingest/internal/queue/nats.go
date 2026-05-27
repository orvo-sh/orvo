package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/orvo-sh/orvo/apps/ingest/internal/config"
	"github.com/orvo-sh/orvo/apps/ingest/internal/telemetry"
)

type Client struct {
	conn      *nats.Conn
	jetstream jetstream.JetStream
	logger    *slog.Logger
	config    config.NatsConfig
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

	client := &Client{
		conn:      conn,
		jetstream: js,
		logger:    logger,
		config:    cfg,
	}

	if err := client.ensureStream(ctx); err != nil {
		conn.Close()
		return nil, err
	}

	return client, nil
}

func (client *Client) ensureStream(ctx context.Context) error {
	_, err := client.jetstream.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:     config.TelemetryStreamName,
		Subjects: []string{config.TelemetryLogsSubject, config.TelemetryTracesSubject, config.TelemetryMetricsSubject},
		Storage:  jetstream.FileStorage,
	})
	if err != nil {
		return fmt.Errorf("nats: ensure stream %s: %w", config.TelemetryStreamName, err)
	}

	return nil
}

func (client *Client) CheckReady(ctx context.Context) error {
	if client.conn.Status() != nats.CONNECTED {
		return fmt.Errorf("nats: connection not ready")
	}

	if err := client.conn.FlushWithContext(ctx); err != nil {
		return fmt.Errorf("nats: flush failed: %w", err)
	}

	return nil
}

func (client *Client) PublishLogs(ctx context.Context, message telemetry.LogsMessage) error {
	return client.publish(ctx, config.TelemetryLogsSubject, message)
}

func (client *Client) PublishTraces(ctx context.Context, message telemetry.TracesMessage) error {
	return client.publish(ctx, config.TelemetryTracesSubject, message)
}

func (client *Client) PublishMetrics(ctx context.Context, message telemetry.MetricsMessage) error {
	return client.publish(ctx, config.TelemetryMetricsSubject, message)
}

func (client *Client) publish(ctx context.Context, subject string, message any) error {
	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("nats: marshal message for %s: %w", subject, err)
	}

	publishCtx, cancel := context.WithTimeout(ctx, client.config.PublishTimeout)
	defer cancel()

	ack, err := client.jetstream.Publish(publishCtx, subject, body)
	if err != nil {
		return fmt.Errorf("nats: publish %s: %w", subject, err)
	}

	client.logger.InfoContext(ctx, "Publish: published telemetry message",
		slog.String("subject", subject),
		slog.String("stream", ack.Stream),
		slog.Uint64("sequence", ack.Sequence),
	)

	return nil
}

func (client *Client) Close() {
	client.conn.Close()
}
