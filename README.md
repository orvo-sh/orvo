# Orvo

An observability platform built as a Turborepo monorepo. Orvo ingests logs, traces, and metrics via OpenTelemetry, stores them in ClickHouse, and provides a SvelteKit dashboard for exploration, alerting, and insights.

## Apps

| App      | Description                                                                         | Runtime             |
| -------- | ----------------------------------------------------------------------------------- | ------------------- |
| `app`    | Main dashboard — organizations, apps, logs, traces, metrics, alerts, and incidents | SvelteKit + Node.js |
| `ingest` | OTLP HTTP ingestion service for logs, traces, metrics, and heartbeat check-ins     | Go                  |
| `agent`  | Curated OpenTelemetry Collector distribution for host monitoring                   | Go                  |
| `local`  | Local-first Orvo runtime and CLI                                                    | Go + Node.js        |
| `site`   | Marketing and product documentation site                                           | SvelteKit           |

## Packages

| Package                   | Description                                |
| ------------------------- | ------------------------------------------ |
| `@repo/components`        | Shared shadcn-svelte UI component library  |
| `@repo/db`                | Drizzle ORM schemas and PostgreSQL client  |
| `@repo/clickhouse`        | ClickHouse analytics client and migrations |
| `@repo/logger`            | OpenTelemetry structured logging with Pino |
| `@repo/encryption`        | Encryption utilities                       |
| `@repo/storage`           | S3-compatible object storage client        |
| `@repo/utils`             | Shared utilities (ULID generation, etc.)   |
| `@repo/eslint-config`     | Shared ESLint configuration                |
| `@repo/typescript-config` | Shared TypeScript configuration            |

## Tech Stack

- **Frontend:** SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS v4, shadcn-svelte
- **Backend:** SvelteKit (Node.js adapter), Go 1.24
- **Databases:** PostgreSQL (Drizzle ORM), ClickHouse
- **Observability:** OpenTelemetry (OTLP ingestion, tracing, logging)
- **Auth:** Better Auth
- **Billing:** Stripe
- **Email:** Resend
- **Storage:** S3-compatible
- **Testing:** Playwright, Vitest, testcontainers
- **Build:** Turborepo, pnpm, Vite

## Prerequisites

- Node.js >= 18
- pnpm 10.x
- Go 1.24 or newer for `ingest`; Go 1.25 or newer for `agent`
- PostgreSQL
- ClickHouse
- (Optional) S3-compatible storage, Stripe, Resend

## Getting Started

Install dependencies:

```sh
pnpm install
```

Run the development servers:

```sh
# Run all apps in parallel
pnpm dev

# Or run a specific app
pnpm --filter app dev
pnpm --filter ingest dev
```

Build and test the host agent independently:

```sh
cd apps/agent
make test
make build
```

Build all apps and packages:

```sh
pnpm build
```

Run type checks:

```sh
pnpm check-types
```

Run tests:

```sh
pnpm test
```

## Production

Commits to `main` publish immutable application and ingest images to GitHub
Container Registry. Orvo Cloud promotes a selected image version independently.
Self-hosted deployment assets will live under `deploy/self-hosted`.

## Database

The `app` package provides shortcuts for database operations:

```sh
# Push schema changes (development)
pnpm --filter app db:push

# Generate migrations
pnpm --filter app db:generate

# Run migrations
pnpm --filter app db:migrate

# Open Drizzle Studio
pnpm --filter app db:studio
```

## Project Structure

```
├── apps/
│   ├── app/              # Main dashboard application
│   ├── ingest/           # Go OTLP ingestion service
│   ├── agent/            # Go host monitoring agent
│   └── site/             # Marketing and product documentation
├── packages/
│   ├── components/       # Shared UI components
│   ├── db/               # Database schemas and client
│   ├── clickhouse/       # ClickHouse client
│   ├── logger/           # Structured logging
│   ├── encryption/       # Encryption helpers
│   ├── storage/          # Object storage client
│   ├── utils/            # Shared utilities
│   ├── eslint-config/    # ESLint presets
│   └── typescript-config/# TypeScript presets
├── package.json          # Root workspace config
├── pnpm-workspace.yaml   # pnpm workspace definition
└── turbo.json            # Turborepo task pipeline
```

## License

Orvo is licensed under the [GNU Affero General Public License v3.0](LICENSE).
