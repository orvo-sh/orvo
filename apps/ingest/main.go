package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/orvo-sh/orvo/apps/ingest/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx); err != nil {
		os.Exit(1)
	}
}
