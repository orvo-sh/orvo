GO ?= go
SQLC ?= sqlc

.PHONY: build test run tidy generate

build:
	$(GO) build ./...

test:
	$(GO) test ./...

run:
	set -a; [ -f .env ] && . ./.env; set +a; $(GO) run ./cmd/ingest

tidy:
	$(GO) mod tidy

generate:
	$(SQLC) generate
