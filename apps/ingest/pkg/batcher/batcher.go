package batcher

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"
)

var (
	ErrClosed    = errors.New("batcher is closed")
	ErrQueueFull = errors.New("batcher queue is full")
)

type WriterFunc[T any] func(ctx context.Context, batch []T) error

type Option func(*options)

type options struct {
	batchSize     int
	flushInterval time.Duration
	maxQueueSize  int
	writeTimeout  time.Duration
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

func WithWriteTimeout(timeout time.Duration) Option {
	return func(o *options) { o.writeTimeout = timeout }
}

type Batcher[T any] struct {
	logger  *slog.Logger
	options options
	input   chan T
	writeFn WriterFunc[T]

	done chan struct{}
	wg   sync.WaitGroup
	once sync.Once
}

func New[T any](logger *slog.Logger, writer WriterFunc[T], opts ...Option) *Batcher[T] {
	o := options{
		batchSize:     1000,
		flushInterval: 5 * time.Second,
		maxQueueSize:  10000,
		writeTimeout:  10 * time.Second,
	}

	for _, set := range opts {
		set(&o)
	}

	b := &Batcher[T]{
		logger:  logger,
		options: o,
		input:   make(chan T, o.maxQueueSize),
		writeFn: writer,
		done:    make(chan struct{}),
	}

	b.wg.Add(1)
	go b.loop()

	return b
}

func (b *Batcher[T]) Push(ctx context.Context, item T) error {
	select {
	case <-ctx.Done():
		return fmt.Errorf("batcher: push canceled: %w", ctx.Err())
	case <-b.done:
		return ErrClosed
	case b.input <- item:
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

	batch := make([]T, 0, b.options.batchSize)

	flush := func(reason string) {
		if len(batch) == 0 {
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), b.options.writeTimeout)
		defer cancel()

		if err := b.writeFn(ctx, batch); err != nil {
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
