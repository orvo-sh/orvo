package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"go.opentelemetry.io/otel/propagation"
)

type natsHeaderCarrier nats.Header

func (c natsHeaderCarrier) Get(key string) string {
	return nats.Header(c).Get(key)
}

func (c natsHeaderCarrier) Set(key, value string) {
	nats.Header(c).Set(key, value)
}

func (c natsHeaderCarrier) Keys() []string {
	keys := make([]string, 0, len(c))
	for k := range c {
		keys = append(keys, k)
	}
	return keys
}

type QueueClient struct {
	conn      *nats.Conn
	jetstream jetstream.JetStream
	logger    *slog.Logger
	config    NatsConfig
}

func NewQueueClient(ctx context.Context, logger *slog.Logger, cfg NatsConfig) (*QueueClient, error) {
	conn, err := nats.Connect(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("nats: connect: %w", err)
	}

	js, err := jetstream.New(conn)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("nats: create jetstream client: %w", err)
	}

	client := &QueueClient{
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

func (client *QueueClient) ensureStream(ctx context.Context) error {
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

func (client *QueueClient) CheckReady(ctx context.Context) error {
	if client.conn.Status() != nats.CONNECTED {
		return fmt.Errorf("nats: connection not ready")
	}

	if err := client.conn.FlushWithContext(ctx); err != nil {
		return fmt.Errorf("nats: flush failed: %w", err)
	}

	return nil
}

func (client *QueueClient) PublishLogs(ctx context.Context, message LogsMessage) error {
	return client.publish(ctx, TelemetryLogsSubject, message)
}

func (client *QueueClient) PublishTraces(ctx context.Context, message TracesMessage) error {
	return client.publish(ctx, TelemetryTracesSubject, message)
}

func (client *QueueClient) PublishMetrics(ctx context.Context, message MetricsMessage) error {
	return client.publish(ctx, TelemetryMetricsSubject, message)
}

func (client *QueueClient) publish(ctx context.Context, subject string, message any) error {
	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("nats: marshal message for %s: %w", subject, err)
	}

	publishCtx, cancel := context.WithTimeout(ctx, client.config.PublishTimeout)
	defer cancel()

	headers := make(nats.Header)
	propagation.TraceContext{}.Inject(publishCtx, natsHeaderCarrier(headers))

	ack, err := client.jetstream.PublishMsg(publishCtx, &nats.Msg{
		Subject: subject,
		Data:    body,
		Header:  headers,
	})
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

func (client *QueueClient) Close() {
	client.conn.Close()
}
