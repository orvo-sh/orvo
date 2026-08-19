package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	ingestruntime "github.com/orvo-sh/orvo/apps/ingest/runtime"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := ingestruntime.Run(ctx, ingestruntime.ConfigFromEnv()); err != nil {
		log.Fatal(err)
	}
}
