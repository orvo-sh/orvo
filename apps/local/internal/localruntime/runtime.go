package localruntime

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	ingestruntime "github.com/orvo-sh/orvo/apps/ingest/runtime"
	"github.com/orvo-sh/orvo/apps/local/internal/assets"
	localconfig "github.com/orvo-sh/orvo/apps/local/internal/config"
	localpaths "github.com/orvo-sh/orvo/apps/local/internal/paths"
)

type Options struct {
	NoOpen  bool
	Version string
}

func Run(ctx context.Context, paths localpaths.Paths, config localconfig.Config, options Options) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	runtimeRoot, embedded, err := assets.Prepare(paths.Cache, options.Version)
	if err != nil {
		return err
	}
	if !embedded {
		workingDir, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("resolve working directory: %w", err)
		}
		runtimeRoot = findWorkspaceRoot(workingDir)
	}

	bootstrap := valueOrDefault("ORVO_LOCAL_BOOTSTRAP", filepath.Join(runtimeRoot, "apps", "local", "runtime", "bootstrap.mjs"))
	appEntry := valueOrDefault("ORVO_APP_ENTRY", filepath.Join(runtimeRoot, "apps", "app", "build", "index.js"))
	migrations := valueOrDefault("ORVO_POSTGRES_MIGRATIONS", filepath.Join(runtimeRoot, "packages", "db", "drizzle"))
	clickhouseMigrations := valueOrDefault("ORVO_CLICKHOUSE_MIGRATIONS", filepath.Join(runtimeRoot, "packages", "clickhouse", "migrations"))
	node := valueOrDefault("ORVO_NODE", "node")
	if embedded {
		node = filepath.Join(runtimeRoot, "node")
	}

	for _, path := range []string{bootstrap, appEntry, migrations, clickhouseMigrations} {
		if _, err := os.Stat(path); err != nil {
			return fmt.Errorf("local runtime asset %s is unavailable: %w", path, err)
		}
	}

	postgresURL := fmt.Sprintf("postgres://postgres:postgres@127.0.0.1:%d/postgres?sslmode=disable&orvo_single_use=true", config.PostgresPort)
	clickhouseURL := fmt.Sprintf("http://127.0.0.1:%d", config.ClickHousePort)
	appURL, err := dashboardURL(config)
	if err != nil {
		return err
	}
	ingestURL := fmt.Sprintf("http://%s:%d", config.Host, config.IngestPort)

	command := exec.CommandContext(ctx, node, bootstrap)
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	command.Env = append(os.Environ(),
		"ORVO_MODE=local",
		"ORVO_PGLITE_PATH="+filepath.Join(paths.Data, "control"),
		"ORVO_POSTGRES_MIGRATIONS="+migrations,
		"ORVO_CLICKHOUSE_MIGRATIONS="+clickhouseMigrations,
		"ORVO_APP_ENTRY="+appEntry,
		"ORVO_POSTGRES_PORT="+strconv.Itoa(config.PostgresPort),
		"ORVO_CLICKHOUSE_PORT="+strconv.Itoa(config.ClickHousePort),
		"ORVO_CHDB_PATH="+filepath.Join(paths.Data, "telemetry"),
		"POSTGRES_URL=pglite://local",
		"CLICKHOUSE_URL="+clickhouseURL,
		"ENCRYPTION_SECRET="+config.EncryptionSecret,
		"BETTER_AUTH_SECRET="+config.EncryptionSecret,
		"ORVO_SETUP_TOKEN="+config.SetupToken,
		"ORIGIN="+appURL,
		"INGEST_BASE_URL="+ingestURL,
		"HOST="+config.Host,
		"PORT="+strconv.Itoa(config.Port),
	)
	if err := command.Start(); err != nil {
		return fmt.Errorf("start local application runtime: %w", err)
	}

	exit := make(chan error, 1)
	go func() { exit <- command.Wait() }()

	if err := waitForPort(ctx, fmt.Sprintf("127.0.0.1:%d", config.PostgresPort), exit); err != nil {
		return err
	}
	if err := waitForPort(ctx, fmt.Sprintf("127.0.0.1:%d", config.ClickHousePort), exit); err != nil {
		return err
	}

	ingestDone := make(chan error, 1)
	go func() {
		ingestDone <- ingestruntime.Run(ctx, ingestruntime.Config{
			PostgresURL:          postgresURL,
			ClickHouseURL:        clickhouseURL,
			Environment:          "local",
			HTTPHost:             config.Host,
			HTTPPort:             strconv.Itoa(config.IngestPort),
			FlushInterval:        2 * time.Second,
			LogsBatchSize:        500,
			TracesBatchSize:      500,
			MetricsBatchSize:     500,
			HeartbeatBatchSize:   100,
			MaxQueueSize:         5000,
			ClickHouseHTTPBridge: true,
		})
	}()

	if err := waitForPort(ctx, fmt.Sprintf("%s:%d", config.Host, config.Port), exit); err != nil {
		return err
	}
	fmt.Printf("Orvo Local is ready\n\nDashboard: %s\nSetup:     %s/setup?token=%s\nOTLP HTTP: %s\nData:      %s\n", appURL, appURL, config.SetupToken, ingestURL, paths.Data)
	if parsed, _ := url.Parse(appURL); !isLoopbackHost(parsed.Hostname()) && parsed.Scheme != "https" {
		fmt.Println("\nWarning: accounts and session cookies are exposed over plain HTTP. Put Orvo behind HTTPS before sharing it.")
	}
	if !options.NoOpen {
		_ = Open(appURL)
	}

	select {
	case <-ctx.Done():
		return nil
	case err := <-exit:
		return fmt.Errorf("local application runtime stopped: %w", err)
	case err := <-ingestDone:
		return fmt.Errorf("ingestion runtime stopped: %w", err)
	}
}

func DashboardURL(config localconfig.Config) (string, error) {
	return dashboardURL(config)
}

func dashboardURL(config localconfig.Config) (string, error) {
	if config.PublicURL == "" {
		if !isLoopbackHost(config.Host) {
			return "", fmt.Errorf("public_url (or ORVO_PUBLIC_URL) is required when host is not loopback")
		}
		return fmt.Sprintf("http://%s:%d", config.Host, config.Port), nil
	}

	parsed, err := url.Parse(config.PublicURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", fmt.Errorf("public_url must be an absolute http:// or https:// URL")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Path != "" && parsed.Path != "/") {
		return "", fmt.Errorf("public_url must not include a path, query, or fragment")
	}
	return fmt.Sprintf("%s://%s", parsed.Scheme, parsed.Host), nil
}

func isLoopbackHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func waitForPort(ctx context.Context, address string, exited <-chan error) error {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	timeout := time.NewTimer(30 * time.Second)
	defer timeout.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-exited:
			return fmt.Errorf("local application runtime stopped during startup: %w", err)
		case <-timeout.C:
			return fmt.Errorf("timed out waiting for %s", address)
		case <-ticker.C:
			connection, err := net.DialTimeout("tcp", address, 200*time.Millisecond)
			if err == nil {
				_ = connection.Close()
				return nil
			}
		}
	}
}

func valueOrDefault(name string, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func findWorkspaceRoot(start string) string {
	current := start
	for {
		if _, err := os.Stat(filepath.Join(current, "pnpm-workspace.yaml")); err == nil {
			return current
		}
		parent := filepath.Dir(current)
		if parent == current {
			return start
		}
		current = parent
	}
}
