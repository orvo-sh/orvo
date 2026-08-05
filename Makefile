GO ?= go
OCB_VERSION ?= v0.158.0
AGENT_VERSION ?= dev
BUILD_DIR ?= build

.PHONY: build build-agent build-ctl dev generate-agent test tidy clean

build: build-agent build-ctl

generate-agent:
	mkdir -p $(BUILD_DIR)
	sed 's/^  version: .*/  version: $(AGENT_VERSION)/' builder-config.yaml > $(BUILD_DIR)/builder-config.yaml
	$(GO) run go.opentelemetry.io/collector/cmd/builder@$(OCB_VERSION) \
		--config $(BUILD_DIR)/builder-config.yaml \
		--skip-compilation

build-agent: generate-agent
	cd $(BUILD_DIR)/runtime && $(GO) build -o ../orvo-agent .

build-ctl:
	mkdir -p $(BUILD_DIR)
	$(GO) build -ldflags "-X main.version=$(AGENT_VERSION)" -o $(BUILD_DIR)/orvo-agentctl ./cmd/orvo-agentctl

dev: build
	$(BUILD_DIR)/orvo-agentctl dev --agent-binary $(BUILD_DIR)/orvo-agent

test:
	$(GO) test ./...

tidy:
	$(GO) mod tidy

clean:
	rm -rf $(BUILD_DIR)
