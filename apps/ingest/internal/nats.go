package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

type NATSClient struct {
	conn      *nats.Conn
	jetstream jetstream.JetStream
	logger    *slog.Logger
	config    NatsConfig
}

func NewNATSClient(ctx context.Context, logger *slog.Logger, config NatsConfig) (*NATSClient, error) {
	conn, err := nats.Connect(config.URL)
	if err != nil {
		return nil, fmt.Errorf("nats: connect: %w", err)
	}

	js, err := jetstream.New(conn)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("nats: create jetstream client: %w", err)
	}

	client := &NATSClient{
		conn:      conn,
		jetstream: js,
		logger:    logger,
		config:    config,
	}

	if err := client.ensureStream(ctx); err != nil {
		conn.Close()
		return nil, err
	}

	return client, nil
}

func (client *NATSClient) ensureStream(ctx context.Context) error {
	_, err := client.jetstream.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:     TelemetryStreamName,
		Subjects: []string{TelemetryLogsSubject, TelemetryTracesSubject, TelemetryMetricsSubject},
		Storage:  jetstream.FileStorage,
	})
	if err != nil {
		return fmt.Errorf("nats: ensure stream %s: %w", TelemetryStreamName, err)
	}

	return nil
}

func (client *NATSClient) CheckReady(ctx context.Context) error {
	if client.conn.Status() != nats.CONNECTED {
		return fmt.Errorf("nats: connection not ready")
	}

	if err := client.conn.FlushWithContext(ctx); err != nil {
		return fmt.Errorf("nats: flush failed: %w", err)
	}

	return nil
}

func (client *NATSClient) publish(ctx context.Context, subject string, message any) error {
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

func (client *NATSClient) PublishLogs(ctx context.Context, message LogsMessage) error {
	return client.publish(ctx, TelemetryLogsSubject, message)
}

func (client *NATSClient) PublishTraces(ctx context.Context, message TracesMessage) error {
	return client.publish(ctx, TelemetryTracesSubject, message)
}

func (client *NATSClient) PublishMetrics(ctx context.Context, message MetricsMessage) error {
	return client.publish(ctx, TelemetryMetricsSubject, message)
}

func (client *NATSClient) Close() {
	client.conn.Close()
}
