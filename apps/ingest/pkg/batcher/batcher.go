package batcher

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var (
	ErrClosed    = errors.New("batcher is closed")
	ErrQueueFull = errors.New("batcher queue is full")
)

type WriterFunc[T any] func(ctx context.Context, batch []T) error

type queuedItem[T any] struct {
	value       T
	enqueuedAt  time.Time
	spanContext trace.SpanContext
}

type Option func(*options)

type options struct {
	batchSize     int
	flushInterval time.Duration
	maxQueueSize  int
}

func WithBatchSize(size int) Option {
	return func(o *options) { o.batchSize = size }
}

func WithFlushInterval(interval time.Duration) Option {
	return func(o *options) { o.flushInterval = interval }
}

func WithMaxQueueSize(size int) Option {
	return func(o *options) { o.maxQueueSize = size }
}

type Batcher[T any] struct {
	logger  *slog.Logger
	options options
	input   chan queuedItem[T]
	writeFn WriterFunc[T]
	tracer  trace.Tracer

	done chan struct{}
	wg   sync.WaitGroup
	once sync.Once
}

func New[T any](logger *slog.Logger, writer WriterFunc[T], opts ...Option) *Batcher[T] {
	o := options{
		batchSize:     1000,
		flushInterval: 5 * time.Second,
		maxQueueSize:  10000,
	}

	for _, set := range opts {
		set(&o)
	}

	b := &Batcher[T]{
		logger:  logger,
		options: o,
		input:   make(chan queuedItem[T], o.maxQueueSize),
		writeFn: writer,
		tracer:  otel.Tracer("github.com/orvo-sh/orvo/apps/ingest/pkg/batcher"),
		done:    make(chan struct{}),
	}

	b.wg.Add(1)
	go b.loop()

	return b
}

func (b *Batcher[T]) Push(ctx context.Context, item T) error {
	enqueuedAt := time.Now().UTC()
	spanContext := trace.SpanContextFromContext(ctx)

	select {
	case <-ctx.Done():
		return fmt.Errorf("batcher: push canceled: %w", ctx.Err())
	case <-b.done:
		return ErrClosed
	case b.input <- queuedItem[T]{
		value:       item,
		enqueuedAt:  enqueuedAt,
		spanContext: spanContext,
	}:
		return nil
	default:
		return ErrQueueFull
	}
}

func (b *Batcher[T]) Close() {
	b.once.Do(func() {
		close(b.done)
		b.wg.Wait()
	})
}

func (b *Batcher[T]) loop() {
	defer b.wg.Done()

	defer func() {
		if r := recover(); r != nil {
			b.logger.Error("loop: batcher loop panicked",
				slog.Any("panic", r),
				slog.String("stack", string(debug.Stack())),
			)
		}
	}()

	ticker := time.NewTicker(b.options.flushInterval)
	defer ticker.Stop()

	batch := make([]queuedItem[T], 0, b.options.batchSize)

	flush := func(reason string) {
		if len(batch) == 0 {
			return
		}

		links := make([]trace.Link, 0, len(batch))
		values := make([]T, 0, len(batch))
		now := time.Now().UTC()
		oldestAge := time.Duration(0)
		newestAge := time.Duration(0)

		for index, item := range batch {
			values = append(values, item.value)

			if item.spanContext.IsValid() {
				links = append(links, trace.Link{SpanContext: item.spanContext})
			}

			age := now.Sub(item.enqueuedAt)
			if index == 0 || age > oldestAge {
				oldestAge = age
			}
			if index == 0 || age < newestAge {
				newestAge = age
			}
		}

		ctx, flushSpan := b.tracer.Start(
			context.Background(),
			"batcher.flush",
			trace.WithSpanKind(trace.SpanKindInternal),
			trace.WithLinks(links...),
			trace.WithAttributes(
				attribute.String("batcher.flush.reason", reason),
				attribute.Int("batcher.batch.size", len(batch)),
				attribute.Int64("batcher.queue.oldest_ms", oldestAge.Milliseconds()),
				attribute.Int64("batcher.queue.newest_ms", newestAge.Milliseconds()),
			),
		)
		defer flushSpan.End()

		ctx, cancel := context.WithTimeout(ctx, 120*time.Second)
		defer cancel()

		if err := b.writeFn(ctx, values); err != nil {
			flushSpan.RecordError(err)
			b.logger.Error("loop: batch flush failed",
				slog.String("reason", reason),
				slog.Int("count", len(batch)),
				slog.Any("error", err),
			)
			return
		}

		b.logger.Info("loop: batch flushed",
			slog.String("reason", reason),
			slog.Int("count", len(batch)),
		)
		batch = batch[:0]
	}

	drain := func() {
		for {
			select {
			case item := <-b.input:
				batch = append(batch, item)
			default:
				flush("shutdown")
				return
			}
		}
	}

	for {
		select {
		case item := <-b.input:
			batch = append(batch, item)
			if len(batch) >= b.options.batchSize {
				flush("size")
				ticker.Reset(b.options.flushInterval)
			}
		case <-ticker.C:
			flush("interval")
		case <-b.done:
			drain()
			return
		}
	}
}
