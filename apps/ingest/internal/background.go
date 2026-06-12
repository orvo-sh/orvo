package ingest

import (
	"context"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"
)

type BackgroundConfig struct {
	DefaultTimeout time.Duration
}

type BackgroundManager struct {
	logger *slog.Logger
	config BackgroundConfig
	wg     sync.WaitGroup
}

func NewBackgroundManager(logger *slog.Logger, config BackgroundConfig) *BackgroundManager {
	return &BackgroundManager{
		logger: logger,
		config: config,
	}
}

func (manager *BackgroundManager) Run(fn func(ctx context.Context)) {
	manager.wg.Add(1)

	go func() {
		defer manager.wg.Done()

		defer func() {
			if recovered := recover(); recovered != nil {
				manager.logger.Error("background task panicked",
					slog.Any("panic", recovered),
					slog.String("stack", string(debug.Stack())),
				)
			}
		}()

		ctx, cancel := context.WithTimeout(context.Background(), manager.config.DefaultTimeout)
		defer cancel()

		fn(ctx)
	}()
}

func (manager *BackgroundManager) Wait() {
	manager.wg.Wait()
}
