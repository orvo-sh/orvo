package telemetry

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/config"
	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/entitlements"
	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/queue"
)

type clickhouseWriter interface {
	InsertLogs(ctx context.Context, rows []LogRow) error
	InsertTraces(ctx context.Context, rows []TraceRow) error
	InsertMetrics(ctx context.Context, rows []MetricRow) error
}

type entitlementSource interface {
	Get(ctx context.Context, organizationID string) (entitlements.Policy, error)
}

type Service struct {
	logger       *slog.Logger
	nats         *queue.Client
	clickhouse   clickhouseWriter
	entitlements entitlementSource
	config       config.WriterConfig
}

func NewService(
	logger *slog.Logger,
	natsClient *queue.Client,
	clickhouseClient clickhouseWriter,
	entitlementCache entitlementSource,
	cfg config.WriterConfig,
) *Service {
	return &Service{
		logger:       logger,
		nats:         natsClient,
		clickhouse:   clickhouseClient,
		entitlements: entitlementCache,
		config:       cfg,
	}
}

func (service *Service) Run(ctx context.Context) error {
	logsConsumer, err := service.nats.CreateConsumer(ctx, "telemetry-writer-logs", queue.TelemetryLogsSubject)
	if err != nil {
		return err
	}
	tracesConsumer, err := service.nats.CreateConsumer(ctx, "telemetry-writer-traces", queue.TelemetryTracesSubject)
	if err != nil {
		return err
	}
	metricsConsumer, err := service.nats.CreateConsumer(ctx, "telemetry-writer-metrics", queue.TelemetryMetricsSubject)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		service.runLogWorker(ctx, logsConsumer)
	}()
	go func() {
		defer wg.Done()
		service.runTraceWorker(ctx, tracesConsumer)
	}()
	go func() {
		defer wg.Done()
		service.runMetricWorker(ctx, metricsConsumer)
	}()

	<-ctx.Done()
	wg.Wait()
	return nil
}

type messageBatch[T any] struct {
	rows          []T
	msgs          []jetstream.Msg
	bytes         int
	firstReceived time.Time
	maxRows       int
	maxBytes      int
	flushInterval time.Duration
}

func newMessageBatch[T any](maxRows int, maxBytes int, flushInterval time.Duration) *messageBatch[T] {
	return &messageBatch[T]{
		maxRows:       maxRows,
		maxBytes:      maxBytes,
		flushInterval: flushInterval,
	}
}

func (batch *messageBatch[T]) Add(rows []T, msg jetstream.Msg, bytes int) {
	if len(rows) == 0 {
		return
	}
	if batch.firstReceived.IsZero() {
		batch.firstReceived = time.Now().UTC()
	}
	batch.rows = append(batch.rows, rows...)
	batch.msgs = append(batch.msgs, msg)
	batch.bytes += bytes
}

func (batch *messageBatch[T]) Empty() bool {
	return len(batch.rows) == 0
}

func (batch *messageBatch[T]) ShouldFlush(now time.Time) bool {
	if batch.Empty() {
		return false
	}
	if len(batch.rows) >= batch.maxRows {
		return true
	}
	if batch.bytes >= batch.maxBytes {
		return true
	}
	return now.Sub(batch.firstReceived) >= batch.flushInterval
}

func (batch *messageBatch[T]) Reset() {
	batch.rows = nil
	batch.msgs = nil
	batch.bytes = 0
	batch.firstReceived = time.Time{}
}

func (service *Service) runLogWorker(ctx context.Context, consumer jetstream.Consumer) {
	logger := service.logger.With(slog.String("signal", "logs"))
	iterator, err := consumer.Messages(jetstream.PullMaxMessages(service.config.PullMaxMessages))
	if err != nil {
		logger.Error("RunLogs: failed to create iterator", slog.Any("error", err))
		return
	}
	defer iterator.Stop()

	batch := newMessageBatch[LogRow](service.config.LogsBatchSize, service.config.LogsBatchBytes, service.config.FlushInterval)
	runWorkerLoop(ctx, logger, iterator, batch, service.config.FetchMaxWait, service.config.ShutdownFlushTimeout, service.decodeLogs, service.flushLogs)
}

func (service *Service) runTraceWorker(ctx context.Context, consumer jetstream.Consumer) {
	logger := service.logger.With(slog.String("signal", "traces"))
	iterator, err := consumer.Messages(jetstream.PullMaxMessages(service.config.PullMaxMessages))
	if err != nil {
		logger.Error("RunTraces: failed to create iterator", slog.Any("error", err))
		return
	}
	defer iterator.Stop()

	batch := newMessageBatch[TraceRow](service.config.TracesBatchSize, service.config.TracesBatchBytes, service.config.FlushInterval)
	runWorkerLoop(ctx, logger, iterator, batch, service.config.FetchMaxWait, service.config.ShutdownFlushTimeout, service.decodeTraces, service.flushTraces)
}

func (service *Service) runMetricWorker(ctx context.Context, consumer jetstream.Consumer) {
	logger := service.logger.With(slog.String("signal", "metrics"))
	iterator, err := consumer.Messages(jetstream.PullMaxMessages(service.config.PullMaxMessages))
	if err != nil {
		logger.Error("RunMetrics: failed to create iterator", slog.Any("error", err))
		return
	}
	defer iterator.Stop()

	batch := newMessageBatch[MetricRow](service.config.MetricsBatchSize, service.config.MetricsBatchBytes, service.config.FlushInterval)
	runWorkerLoop(ctx, logger, iterator, batch, service.config.FetchMaxWait, service.config.ShutdownFlushTimeout, service.decodeMetrics, service.flushMetrics)
}

func runWorkerLoop[T any](
	ctx context.Context,
	logger *slog.Logger,
	iterator jetstream.MessagesContext,
	batch *messageBatch[T],
	fetchMaxWait time.Duration,
	shutdownFlushTimeout time.Duration,
	decode func(context.Context, []byte) ([]T, error),
	flush func(context.Context, *messageBatch[T], *slog.Logger),
) {
	for {
		if ctx.Err() != nil {
			flushOnShutdown(batch, logger, shutdownFlushTimeout, flush)
			return
		}

		msg, err := iterator.Next(jetstream.NextMaxWait(fetchMaxWait))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) {
				if batch.ShouldFlush(time.Now().UTC()) {
					flush(ctx, batch, logger)
				}
				continue
			}

			logger.Error("RunWorkerLoop: iterator error", slog.Any("error", err))
			if batch.ShouldFlush(time.Now().UTC()) {
				flush(ctx, batch, logger)
			}
			continue
		}

		rows, err := decode(ctx, msg.Data())
		if err != nil {
			logger.Error("RunWorkerLoop: failed to decode message", slog.Any("error", err))
			if termErr := msg.Term(); termErr != nil {
				logger.Error("RunWorkerLoop: failed to term message", slog.Any("error", termErr))
			}
			continue
		}

		if len(rows) == 0 {
			if ackErr := msg.Ack(); ackErr != nil {
				logger.Error("RunWorkerLoop: failed to ack empty message", slog.Any("error", ackErr))
			}
			continue
		}

		batch.Add(rows, msg, len(msg.Data()))
		if batch.ShouldFlush(time.Now().UTC()) {
			flush(ctx, batch, logger)
		}
	}
}

func flushOnShutdown[T any](batch *messageBatch[T], logger *slog.Logger, shutdownFlushTimeout time.Duration, flush func(context.Context, *messageBatch[T], *slog.Logger)) {
	if batch.Empty() {
		return
	}

	flushCtx, cancel := context.WithTimeout(context.Background(), shutdownFlushTimeout)
	defer cancel()
	flush(flushCtx, batch, logger)
}

func (service *Service) flushLogs(ctx context.Context, batch *messageBatch[LogRow], logger *slog.Logger) {
	flushBatch(ctx, batch, logger, "logs", func(ctx context.Context, rows []LogRow) error {
		return service.clickhouse.InsertLogs(ctx, rows)
	})
}

func (service *Service) flushTraces(ctx context.Context, batch *messageBatch[TraceRow], logger *slog.Logger) {
	flushBatch(ctx, batch, logger, "traces", func(ctx context.Context, rows []TraceRow) error {
		return service.clickhouse.InsertTraces(ctx, rows)
	})
}

func (service *Service) flushMetrics(ctx context.Context, batch *messageBatch[MetricRow], logger *slog.Logger) {
	flushBatch(ctx, batch, logger, "metrics", func(ctx context.Context, rows []MetricRow) error {
		return service.clickhouse.InsertMetrics(ctx, rows)
	})
}

func flushBatch[T any](ctx context.Context, batch *messageBatch[T], logger *slog.Logger, signal string, insert func(context.Context, []T) error) {
	if batch.Empty() {
		return
	}

	ctx, span := otel.Tracer(config.ServiceName).Start(ctx, "TelemetryWriter.FlushBatch")
	span.SetAttributes(
		attribute.String("telemetry.signal", signal),
		attribute.Int("telemetry.row_count", len(batch.rows)),
		attribute.Int("messaging.message_count", len(batch.msgs)),
	)
	defer span.End()

	if err := insert(ctx, batch.rows); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		logger.Error("FlushBatch: failed to insert batch",
			slog.String("signal", signal),
			slog.Int("row_count", len(batch.rows)),
			slog.Any("error", err),
		)
		for _, msg := range batch.msgs {
			if nakErr := msg.Nak(); nakErr != nil {
				span.RecordError(nakErr)
				logger.Error("FlushBatch: failed to nak message", slog.Any("error", nakErr))
			}
		}
		batch.Reset()
		return
	}

	for _, msg := range batch.msgs {
		if err := msg.Ack(); err != nil {
			span.RecordError(err)
			logger.Error("FlushBatch: failed to ack message", slog.Any("error", err))
		}
	}

	span.SetStatus(codes.Ok, "")

	logger.Info("FlushBatch: wrote telemetry rows",
		slog.String("signal", signal),
		slog.Int("row_count", len(batch.rows)),
		slog.Int("message_count", len(batch.msgs)),
	)

	batch.Reset()
}

func (service *Service) decodeLogs(ctx context.Context, payload []byte) ([]LogRow, error) {
	var message LogsMessage
	if err := json.Unmarshal(payload, &message); err != nil {
		return nil, fmt.Errorf("unmarshal logs message: %w", err)
	}

	policy, err := service.entitlements.Get(ctx, message.AppID)
	if err != nil {
		return nil, err
	}

	if len(message.Records) == 0 {
		return nil, nil
	}

	receivedAt := NormalizeTime(message.ReceivedAt, time.Now().UTC())
	rows := make([]LogRow, 0, len(message.Records))
	for _, record := range message.Records {
		timestamp := NormalizeTime(record.Timestamp, receivedAt)
		observedAt := NormalizeTime(record.ObservedTimestamp, timestamp)
		expiresAt := ComputeExpiresAt("logs", timestamp, policy)
		if !expiresAt.After(receivedAt) {
			continue
		}
		rows = append(rows, LogRow{
			ID:                    GenerateID("log"),
			AppID:                 message.AppID,
			IngestionKeyID:        message.IngestionKeyID,
			ReceivedAt:            receivedAt,
			ExpiresAt:             expiresAt,
			Timestamp:             timestamp,
			ObservedTimestamp:     observedAt,
			SeverityNumber:        record.SeverityNumber,
			SeverityText:          record.SeverityText,
			Body:                  record.Body,
			TraceID:               record.TraceID,
			SpanID:                record.SpanID,
			TraceFlags:            record.TraceFlags,
			ResourceAttributes:    NormalizeStringMap(record.ResourceAttributes),
			ResourceSchemaURL:     record.ResourceSchemaURL,
			ScopeName:             record.ScopeName,
			ScopeVersion:          record.ScopeVersion,
			ScopeAttributes:       NormalizeStringMap(record.ScopeAttributes),
			ScopeSchemaURL:        record.ScopeSchemaURL,
			LogAttributes:         NormalizeStringMap(record.LogAttributes),
			ServiceName:           record.ServiceName,
			DeploymentEnvironment: record.DeploymentEnvironment,
		})
	}

	return rows, nil
}

func (service *Service) decodeTraces(ctx context.Context, payload []byte) ([]TraceRow, error) {
	var message TracesMessage
	if err := json.Unmarshal(payload, &message); err != nil {
		return nil, fmt.Errorf("unmarshal traces message: %w", err)
	}

	policy, err := service.entitlements.Get(ctx, message.AppID)
	if err != nil {
		return nil, err
	}

	if len(message.Spans) == 0 {
		return nil, nil
	}

	receivedAt := NormalizeTime(message.ReceivedAt, time.Now().UTC())
	rows := make([]TraceRow, 0, len(message.Spans))
	for _, span := range message.Spans {
		startTime := NormalizeTime(span.StartTime, receivedAt)
		endTime := NormalizeTime(span.EndTime, startTime)
		expiresAt := ComputeExpiresAt("traces", startTime, policy)
		if !expiresAt.After(receivedAt) {
			continue
		}
		rows = append(rows, TraceRow{
			ID:                    GenerateID("trc"),
			AppID:                 message.AppID,
			IngestionKeyID:        message.IngestionKeyID,
			ReceivedAt:            receivedAt,
			ExpiresAt:             expiresAt,
			TraceID:               span.TraceID,
			SpanID:                span.SpanID,
			ParentSpanID:          span.ParentSpanID,
			TraceState:            span.TraceState,
			Name:                  span.Name,
			Kind:                  span.Kind,
			StartTime:             startTime,
			EndTime:               endTime,
			DurationNs:            span.DurationNs,
			StatusCode:            span.StatusCode,
			StatusMessage:         span.StatusMessage,
			ResourceAttributes:    NormalizeStringMap(span.ResourceAttributes),
			ScopeAttributes:       NormalizeStringMap(span.ScopeAttributes),
			SpanAttributes:        NormalizeStringMap(span.SpanAttributes),
			ResourceSchemaURL:     span.ResourceSchemaURL,
			ScopeName:             span.ScopeName,
			ScopeVersion:          span.ScopeVersion,
			ScopeSchemaURL:        span.ScopeSchemaURL,
			EventsJSON:            MarshalJSON(span.Events, "[]"),
			LinksJSON:             MarshalJSON(span.Links, "[]"),
			ServiceName:           span.ServiceName,
			DeploymentEnvironment: span.DeploymentEnvironment,
		})
	}

	return rows, nil
}

func (service *Service) decodeMetrics(ctx context.Context, payload []byte) ([]MetricRow, error) {
	var message MetricsMessage
	if err := json.Unmarshal(payload, &message); err != nil {
		return nil, fmt.Errorf("unmarshal metrics message: %w", err)
	}

	policy, err := service.entitlements.Get(ctx, message.AppID)
	if err != nil {
		return nil, err
	}

	if len(message.Points) == 0 {
		return nil, nil
	}

	receivedAt := NormalizeTime(message.ReceivedAt, time.Now().UTC())
	rows := make([]MetricRow, 0, len(message.Points))
	for _, point := range message.Points {
		pointTime := NormalizeTime(point.Time, receivedAt)
		startTime := NormalizeTime(point.StartTime, pointTime)
		expiresAt := ComputeExpiresAt("metrics", pointTime, policy)
		if !expiresAt.After(receivedAt) {
			continue
		}
		identity := ResolveMetricIdentity(point)
		rows = append(rows, MetricRow{
			ID:                      GenerateID("met"),
			AppID:                   message.AppID,
			IngestionKeyID:          message.IngestionKeyID,
			ReceivedAt:              receivedAt,
			ExpiresAt:               expiresAt,
			EntityKind:              identity.EntityKind,
			HostID:                  identity.HostID,
			HostName:                identity.HostName,
			HostArch:                identity.HostArch,
			OSType:                  identity.OSType,
			ContainerID:             identity.ContainerID,
			ContainerName:           identity.ContainerName,
			ContainerImageName:      identity.ContainerImageName,
			MetricName:              point.MetricName,
			MetricType:              point.MetricType,
			MetricUnit:              point.MetricUnit,
			Description:             point.Description,
			ServiceName:             point.ServiceName,
			DeploymentEnvironment:   point.DeploymentEnvironment,
			ResourceAttributes:      NormalizeStringMap(point.ResourceAttributes),
			ScopeName:               point.ScopeName,
			ScopeVersion:            point.ScopeVersion,
			Attributes:              NormalizeStringMap(point.Attributes),
			StartTime:               startTime,
			Time:                    pointTime,
			ValueInt:                point.ValueInt,
			ValueDouble:             point.ValueDouble,
			AggregationTemporality:  point.AggregationTemporality,
			IsMonotonic:             point.IsMonotonic,
			HistogramCount:          point.HistogramCount,
			HistogramSum:            point.HistogramSum,
			HistogramMin:            point.HistogramMin,
			HistogramMax:            point.HistogramMax,
			HistogramBucketCounts:   point.HistogramBucketCounts,
			HistogramExplicitBounds: point.HistogramExplicitBounds,
			ExemplarsJSON:           MarshalJSON(point.Exemplars, "[]"),
			Flags:                   point.Flags,
		})
	}

	return rows, nil
}

func ComputeExpiresAt(signal string, eventTime time.Time, policy entitlements.Policy) time.Time {
	baseTime := NormalizeTime(eventTime, time.Now().UTC())
	retentionDays := policy.RetentionDays(signal)
	if retentionDays <= 0 {
		retentionDays = config.DefaultLogsRetentionDays
	}
	return baseTime.Add(time.Duration(retentionDays) * 24 * time.Hour)
}
