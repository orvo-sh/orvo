GO ?= go

.PHONY: build test run tidy

build:
	$(GO) build ./...

test:
	$(GO) test ./...

run:
	set -a; [ -f .env ] && . ./.env; set +a; $(GO) run .

tidy:
	$(GO) mod tidy
