package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/orvo-sh/orvo/apps/ingest/internal"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := ingest.Run(ctx); err != nil {
		os.Exit(1)
	}
}
