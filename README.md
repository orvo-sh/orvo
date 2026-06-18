# Orvo

An observability platform built as a Turborepo monorepo. Orvo ingests logs, traces, and metrics via OpenTelemetry, stores them in ClickHouse, and provides a SvelteKit dashboard for exploration, alerting, and insights.

## Apps

| App                | Description                                                                  | Runtime             |
| ------------------ | ---------------------------------------------------------------------------- | ------------------- |
| `app`              | Main dashboard — organizations, apps, logs, traces, metrics, alerts, billing | SvelteKit + Node.js |
| `web`              | Landing/marketing site                                                       | SvelteKit           |
| `docs`             | Documentation site                                                           | SvelteKit           |
| `ingest`           | OTLP HTTP ingestion service for logs, traces, and metrics                    | Go                  |
| `telemetry-writer` | Consumes telemetry from NATS and writes batches to ClickHouse                | Go                  |
| `alerts-worker`    | Evaluates alert rules and delivers webhook notifications                     | Node.js             |

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
- **Messaging:** NATS
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
- Go 1.24 (for `ingest` and `telemetry-writer`)
- PostgreSQL
- ClickHouse
- NATS
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
│   ├── web/              # Marketing site
│   ├── docs/             # Documentation
│   ├── ingest/           # Go OTLP ingestion service
│   ├── telemetry-writer/ # Go ClickHouse writer service
│   └── alerts-worker/    # Alert evaluation worker
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

[Add your license here]
