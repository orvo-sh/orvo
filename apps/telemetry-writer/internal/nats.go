package writer

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

type NATSClient struct {
	conn   *nats.Conn
	stream jetstream.Stream
	logger *slog.Logger
	config NatsConfig
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

	stream, err := js.Stream(ctx, TelemetryStreamName)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("nats: get stream %s: %w", TelemetryStreamName, err)
	}

	return &NATSClient{
		conn:   conn,
		stream: stream,
		logger: logger,
		config: config,
	}, nil
}

func (client *NATSClient) CreateConsumer(ctx context.Context, durable string, subject string) (jetstream.Consumer, error) {
	return client.stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:       durable,
		Name:          durable,
		FilterSubject: subject,
		AckPolicy:     jetstream.AckExplicitPolicy,
		AckWait:       client.config.AckWait,
		MaxAckPending: client.config.MaxAckPending,
	})
}

func (client *NATSClient) Close() {
	client.conn.Close()
}
