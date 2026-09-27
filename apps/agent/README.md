# Orvo Agent

[![CI](https://github.com/orvo-sh/orvo/actions/workflows/agent-ci.yml/badge.svg)](https://github.com/orvo-sh/orvo/actions/workflows/agent-ci.yml)
[![Release](https://github.com/orvo-sh/orvo/actions/workflows/agent-release.yml/badge.svg)](https://github.com/orvo-sh/orvo/actions/workflows/agent-release.yml)

Orvo Agent is Orvo's small, curated OpenTelemetry Collector distribution for
host monitoring. It collects host CPU, memory, load, disk, filesystem, network,
paging, and process metrics and sends them to Orvo over OTLP/HTTP.

## Install

Open **Hosts** in Orvo, select **Add host**, and run the generated one-time
command on a Linux server. Enrollment creates a dedicated ingestion key and
configures the agent automatically.

Production installation currently supports systemd-based Linux hosts on amd64
and arm64. The generated command pins a release version, downloads its installer
and artifacts from GitHub Releases, verifies the archive's SHA-256 digest,
enrolls the host, and starts the service as the unprivileged `orvo-agent` user.

Useful commands after installation:

```bash
sudo orvo-agentctl status
sudo orvo-agentctl doctor
sudo orvo-agentctl upgrade
sudo orvo-agentctl uninstall
```

## Develop locally

Go 1.25 or newer is required. On macOS or Linux, run the agent in the foreground
against an OTLP endpoint:

```bash
ORVO_OTLP_ENDPOINT=http://localhost:4318 \
ORVO_INGESTION_KEY=ing_your_key \
make dev
```

This uses a temporary configuration and state directory. Press `Ctrl+C` to stop
it. Build and test independently with:

```bash
make test
make build
```

The build produces `build/orvo-agent` and `build/orvo-agentctl`. The collector
components and their pinned versions are defined in `builder-config.yaml`.

## Releases

Agent releases use tags such as `agent-v0.1.1`. Every release must come
from a tested commit on `main` and include curated notes at
`releases/v0.1.1.md`.

1. Update `CHANGELOG.md`, add `releases/vX.Y.Z.md`, and update the version in
   `../app/src/lib/server/services/agent/version.ts`.
2. Merge the PR and confirm CI passes on `main`.
3. Run the **Agent Release** workflow from `main` with the version in `X.Y.Z`
   format:

   ```bash
   gh workflow run agent-release.yml --ref main -f version=0.1.2
   ```

The release workflow validates the version, release notes, changelog, and
generated install command before testing and cross-compiling Linux amd64 and
arm64 bundles. After the builds pass, it creates the annotated tag, generates
checksums and public build-provenance attestations, publishes the installer and
artifacts in a GitHub Release, and downloads the published assets to verify
their checksums.

Verify a completed release with:

```bash
gh release view agent-v0.1.1
curl --fail --location --remote-name \
  https://github.com/orvo-sh/orvo/releases/download/agent-v0.1.1/orvo-agent_0.1.1_linux_amd64.tar.gz
gh attestation verify orvo-agent_0.1.1_linux_amd64.tar.gz \
  --repo orvo-sh/orvo
```

Never move or reuse a published tag. Fix a faulty release in a new patch version.
Until a separate prerelease channel exists, only stable `agent-vX.Y.Z` tags are
supported.

## Security

Do not include enrollment tokens, ingestion keys, telemetry payloads, or other
secrets in issues or logs. Report security problems privately to
`security@orvo.sh`.
