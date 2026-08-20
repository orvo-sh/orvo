---
title: Local mode
description: Run Orvo on your own machine with local storage and no cloud account.
order: 5
previous: getting-started/introduction
next: getting-started/send-your-first-telemetry
---

# Local mode

Orvo Local runs the dashboard, OTLP ingestion, control database, telemetry store, migrations, and background jobs together on your machine. It does not require an Orvo Cloud account or separate database services.

Use local mode for local development, private experiments, and installations where you want to own the runtime and its data.

:::info
Orvo Local is in development. Until release binaries are published, run it from the source repository using the steps below.
:::

## What runs locally

One Orvo Local process manages:

- The Orvo dashboard.
- OTLP/HTTP ingestion for logs, traces, and metrics.
- PGlite for accounts, organizations, apps, settings, and other control data.
- Embedded chDB storage for telemetry.
- Database migrations and background jobs.

Local mode includes email/password accounts, sessions, profiles, organization roles, membership management, and the core observability workflow. Cloud-only features such as GitHub login, Stripe billing, email delivery, and Scout are not available.

## Run from source

You need Git, pnpm 10, Node.js 18 or later, and Go 1.24.5 or later.

Clone the repository and install its dependencies:

```sh
git clone https://github.com/orvo-sh/orvo.git
cd orvo
pnpm install
```

Build the dashboard for local mode, then start the runtime:

```sh
ORVO_MODE=local pnpm --filter app build
cd apps/local
go run . start
```

Keep the process running. Press `Ctrl+C` to stop it cleanly.

On first start, Orvo creates its configuration and data directories, applies migrations, and prints URLs similar to:

```text
Dashboard: http://127.0.0.1:4173
Setup:     http://127.0.0.1:4173/setup?token=...
OTLP HTTP: http://127.0.0.1:4318
```

The browser opens automatically. Pass `--no-open` if you only want the URLs printed in the terminal:

```sh
go run . start --no-open
```

## Create the owner account

Open the private `Setup` URL printed on first start and create the installation owner. The setup token grants permission to create this first account, so do not share the URL or include it in logs and screenshots.

If you close the terminal before copying it, print the setup URL again:

```sh
go run . setup-token
```

After the installation has an owner, normal public sign-up is disabled. An owner or admin can invite another person from **Settings → Members**. Because local mode does not send email, copy the generated invitation link and deliver it to the recipient yourself.

## Send telemetry

Create an app in the dashboard and copy its ingestion key. Local mode accepts standard OTLP/HTTP requests at:

- `http://127.0.0.1:4318/v1/logs`
- `http://127.0.0.1:4318/v1/traces`
- `http://127.0.0.1:4318/v1/metrics`

Authenticate logs, traces, and metrics with the app's ingestion key:

```http
Authorization: Bearer YOUR_INGESTION_KEY
```

For an application running on the same machine, a typical OpenTelemetry environment configuration is:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer YOUR_INGESTION_KEY
OTEL_SERVICE_NAME=checkout-api
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=development
```

Some SDKs expect signal-specific URLs instead of the base endpoint. Follow [Send your first telemetry](/docs/getting-started/send-your-first-telemetry) or the guide for your language and replace `https://ingest.orvo.sh` with `http://127.0.0.1:4318`.

:::info
Inside Docker, `127.0.0.1` refers to the container itself. Use a host address reachable from the container and expose Orvo explicitly as described below.
:::

## CLI commands

When running from source, replace `orvo` in these examples with `go run .` from `apps/local`.

```text
orvo start [--no-open]  Start in the foreground
orvo status             Show status, endpoints, and the data directory
orvo open               Open the dashboard
orvo doctor             Validate the runtime and writable paths
orvo paths              Show data, config, and cache paths
orvo setup-token        Print the one-time owner setup URL
orvo update             Check for a newer release
orvo upgrade            Verify and install the latest release
orvo version            Print the installed version
```

Run `orvo doctor` first when the runtime does not start. It checks the application build, embedded storage, migrations, runtime dependencies, and writable directories.

## Configuration

Run `orvo paths` to locate `config.json`. Orvo creates it with permissions limited to the current OS user.

The main settings are:

| Setting | Default | Environment override | Purpose |
| --- | --- | --- | --- |
| `host` | `127.0.0.1` | `ORVO_HOST` | Dashboard and ingest bind address. |
| `public_url` | Empty | `ORVO_PUBLIC_URL` | Public dashboard origin used for authentication. |
| `port` | `4173` | `ORVO_PORT` | Dashboard port. |
| `ingest_port` | `4318` | `ORVO_INGEST_PORT` | OTLP/HTTP ingest port. |
| `postgres_port` | `54432` | `ORVO_POSTGRES_PORT` | Internal PGlite socket port. |
| `clickhouse_port` | `58123` | `ORVO_CLICKHOUSE_PORT` | Internal telemetry-store bridge port. |
| `updates_enabled` | `true` | — | Check for local runtime updates. |
| `update_channel` | `stable` | — | Release channel used by the updater. |

The file also contains generated secrets. Treat the complete configuration directory as sensitive and do not commit `config.json`.

## Access from another machine

Orvo binds only to `127.0.0.1` by default. To make it reachable over a LAN or through a reverse proxy, set both a non-loopback host and the exact public dashboard origin:

```sh
ORVO_HOST=0.0.0.0 \
ORVO_PUBLIC_URL=https://orvo.example.com \
go run . start --no-open
```

`public_url` must be an absolute `http://` or `https://` URL without a path, query, or fragment. Orvo rejects a non-loopback host without this value because authentication needs a known origin.

Put any internet-facing installation behind an HTTPS reverse proxy and restrict access with your firewall. A plain HTTP public URL exposes accounts and session cookies in transit. The dashboard and OTLP ingest use separate ports, so route or expose both intentionally.

## Data and backups

Use `orvo paths` to find the installation's data, configuration, and cache directories:

- **Data** contains persistent PGlite control data and chDB telemetry.
- **Config** contains runtime settings and generated secrets.
- **Cache** contains extracted versioned runtime files and can be recreated.

To make a consistent backup, stop Orvo, then copy both the data and configuration directories. Keep the backup encrypted because the configuration includes authentication and encryption secrets. Restoring both directories together preserves the data and the keys needed to read it.

Do not copy a live data directory as your only backup strategy. Verify restores periodically on a separate machine or in isolated directories.

## Updates

Release binaries can check for updates with:

```sh
orvo update
```

Stop the running process before installing one:

```sh
orvo upgrade
```

The updater verifies the downloaded binary against its published SHA-256 checksum before installing it. An upgrade replaces runtime files but does not replace the persistent data directory.

When running from source, pull the version you want, reinstall dependencies if the lockfile changed, rebuild the dashboard, and start Orvo again. Back up the data and configuration directories before upgrading.

## Troubleshooting

If Orvo does not start:

1. Run `orvo doctor` or `go run . doctor`.
2. Run `orvo status` to check for another running instance.
3. Confirm ports `4173`, `4318`, `54432`, and `58123` are free, or change them in `config.json`.
4. Run `orvo paths` and confirm the data and configuration directories are writable.
5. When running from source, rebuild the dashboard after pulling changes.

If telemetry does not appear, confirm that the exporter can reach port `4318`, that it uses OTLP over HTTP, and that the `Authorization` header contains an ingestion key from the local app, not a cloud app.

## Related pages

- [Send your first telemetry](/docs/getting-started/send-your-first-telemetry)
- [Verify your setup](/docs/getting-started/verify-your-setup)
- [OpenTelemetry overview](/docs/opentelemetry/overview)
- [API](/docs/reference/api)
