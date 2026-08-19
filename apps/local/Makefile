VERSION ?= dev

.PHONY: build build-release runtime-archive test

build:
	go build -trimpath -ldflags="-s -w -X main.version=$(VERSION)" -o build/orvo .

runtime-archive:
	rm -rf build/runtime build/deploy-app build/deploy-local internal/assets/runtime.tar.gz
	mkdir -p build/runtime/apps/app build/runtime/apps/local build/runtime/packages/db build/runtime/packages/clickhouse
	pnpm --dir ../.. --config.force-legacy-deploy=true --config.inject-workspace-packages=true --filter app deploy --prod "$$(pwd)/build/deploy-app"
	pnpm --dir ../.. --config.force-legacy-deploy=true --config.inject-workspace-packages=true --filter @orvo/local-runtime deploy --prod "$$(pwd)/build/deploy-local"
	cp -L "$$(command -v node)" build/runtime/node
	cp -R ../app/build build/runtime/apps/app/build
	cp -R runtime build/runtime/apps/local/runtime
	mv build/deploy-app/node_modules build/runtime/apps/app/node_modules
	mv build/deploy-local/node_modules build/runtime/apps/local/node_modules
	cp -R ../../packages/db/drizzle build/runtime/packages/db/drizzle
	cp -R ../../packages/clickhouse/migrations build/runtime/packages/clickhouse/migrations
	COPYFILE_DISABLE=1 tar -C build/runtime -czf internal/assets/runtime.tar.gz .

build-release: runtime-archive
	go build -tags release -trimpath -ldflags="-s -w -X main.version=$(VERSION)" -o build/orvo .

test:
	go test ./...
