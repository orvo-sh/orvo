package test

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go/modules/postgres"

	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
)

func WithPostgresDB(t *testing.T, fn func(*pgclient.Client)) {
	t.Helper()

	ctx := context.Background()
	container, err := postgres.Run(
		ctx,
		"postgres:16-alpine",
		postgres.WithDatabase("orvo_ingest_test"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("password"),
		postgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	defer func() {
		if err := container.Terminate(ctx); err != nil {
			t.Fatalf("terminate postgres container: %v", err)
		}
	}()

	connectionString, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("build postgres connection string: %v", err)
	}

	pool, err := pgxpool.New(ctx, connectionString)
	if err != nil {
		t.Fatalf("open postgres pool: %v", err)
	}
	defer pool.Close()

	applyPostgresMigrations(t, pool)

	client, err := pgclient.New(ctx, connectionString)
	if err != nil {
		t.Fatalf("create postgres client: %v", err)
	}
	defer client.Close()

	fn(client)
}

func applyPostgresMigrations(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	for _, statement := range migrationStatements(t, filepath.Join(repoRoot(t), "packages/db/drizzle"), "--> statement-breakpoint") {
		if _, err := pool.Exec(context.Background(), statement); err != nil {
			t.Fatalf("apply postgres migration: %v\nstatement:\n%s", err, statement)
		}
	}

	for _, statement := range migrationStatements(t, filepath.Join(repoRoot(t), "apps/ingest/internal/infra/postgres/sqlc/schema"), "--> statement-breakpoint") {
		if _, err := pool.Exec(context.Background(), statement); err != nil {
			t.Fatalf("apply postgres migration: %v\nstatement:\n%s", err, statement)
		}
	}
}

func repoRoot(t *testing.T) string {
	t.Helper()

	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve caller path")
	}

	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", ".."))
}

func migrationStatements(t *testing.T, dir string, separator string) []string {
	t.Helper()

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read migration dir %s: %v", dir, err)
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		names = append(names, entry.Name())
	}
	slices.Sort(names)

	statements := make([]string, 0)
	for _, name := range names {
		content, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("read migration file %s: %v", name, err)
		}

		for _, part := range strings.Split(string(content), separator) {
			statement := strings.TrimSpace(part)
			if statement == "" {
				continue
			}
			statements = append(statements, statement)
		}
	}

	return statements
}
