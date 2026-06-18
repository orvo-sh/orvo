package background

import (
	"context"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"
)

type Config struct {
	DefaultTimeout time.Duration
}

type Manager struct {
	logger *slog.Logger
	config Config
	wg     sync.WaitGroup
}

func New(logger *slog.Logger, config Config) *Manager {
	return &Manager{
		logger: logger,
		config: config,
	}
}

func (manager *Manager) Run(fn func(ctx context.Context)) {
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

func (manager *Manager) Wait() {
	manager.wg.Wait()
}
