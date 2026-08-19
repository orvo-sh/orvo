# Orvo Local

Orvo Local is the single-binary local runtime for Orvo. It owns PGlite,
embedded chDB, the SvelteKit dashboard, background jobs, and the Go OTLP HTTP
ingestion runtime. The first start prints a private setup URL. The person who
opens it creates the installation owner account; all later accounts require an
invitation link from an owner or admin.

From the repository root:

```sh
pnpm install
pnpm --filter app build
cd apps/local
go run . start
```

The runtime stores its control database and generated secrets in OS-native Orvo
directories. Run `go run ./apps/local paths` to inspect them.

## CLI

```text
orvo start [--no-open]  Start in the foreground
orvo status             Show status, endpoints, and the data directory
orvo open               Open the dashboard
orvo doctor             Validate the embedded runtime and writable paths
orvo paths              Show data, config, and cache paths
orvo setup-token        Print the one-time owner setup URL
orvo update             Check GitHub for a newer local release
orvo upgrade            Verify and install the latest release
orvo version            Print the installed version
```

The first release start extracts its versioned runtime payload into the cache.
Persistent PGlite and chDB data stays in the data directory and is not replaced
by upgrades.

## Local mode

Set `ORVO_MODE=local` when building the dashboard. GitHub login, Stripe billing,
email delivery, and Scout are omitted with direct `mode === "cloud"` branches.
Email/password accounts, sessions, profiles, organization roles, and membership
management remain available. Because local mode does not send email,
invitations are copyable links from **Settings → Members**. Local background
jobs run in-process without PgBoss.

Orvo binds to `127.0.0.1` by default. To expose it, set `host` and `public_url`
in `config.json` (shown by `orvo paths`), or use `ORVO_HOST` and
`ORVO_PUBLIC_URL`. A non-loopback host is rejected unless an explicit public URL
is configured so authentication uses the correct origin. Put internet-facing
installations behind an HTTPS reverse proxy; the CLI warns when a public URL
uses plain HTTP.

## Releases

`make build-release VERSION=x.y.z` creates one platform-native executable at
`build/orvo`. The binary embeds Node.js, the production dashboard, PGlite, chDB,
and migrations, and does not require a repository checkout or system Node.js.

Push a `local-vX.Y.Z` tag after adding `releases/vX.Y.Z.md`. The local release
workflow builds native Linux and macOS binaries, creates checksums, and
publishes them to GitHub Releases. The updater only installs a binary after its
SHA-256 checksum matches the published checksum file.
