# Orvo Agent

Orvo Agent is a curated OpenTelemetry Collector distribution for host metrics.

## Local development

Run the agent in the foreground on macOS or Linux:

```bash
ORVO_OTLP_ENDPOINT=http://localhost:4318 \
ORVO_INGESTION_KEY=ing_your_key \
make dev
```

This uses a temporary configuration and state directory. Press `Ctrl+C` to stop it.

## Build

```bash
make build
```

The build creates `build/orvo-agent` and `build/orvo-agentctl`.

## Production installation

Generate a one-time command from the Hosts page in Orvo. The installer supports
Linux on amd64 and arm64.

## Releases

Agent versions use semantic versioning with an `agent-v` tag prefix, for example
`agent-v0.1.1`. Release tags must point to a tested commit on `main`.

Use a patch version for fixes and packaging changes, a minor version for new
backwards-compatible monitoring capabilities, and a major version for breaking
configuration or installation changes.

Before tagging:

1. Merge the agent changes into `main` and confirm the required checks pass.
2. Write a short release summary covering user-visible changes, fixes, upgrade
   notes, and known issues.
3. Test and build the agent locally:

   ```bash
   cd apps/host-agent
   GOTOOLCHAIN=go1.25.12 make test build
   ```

4. Create an annotated tag from the intended commit:

   ```bash
   git switch main
   git pull --ff-only
   git tag -a agent-v0.1.1 -m "Orvo Agent 0.1.1"
   git push origin agent-v0.1.1
   ```

Pushing the tag runs `.github/workflows/publish-agent.yml`. The workflow tests
and builds Linux amd64 and arm64 archives, creates SHA-256 checksums and GitHub
artifact attestations, creates the GitHub Release, uploads immutable versioned
artifacts to the CDN, and promotes the version to the stable channel used by the
installer.

Verify the workflow and release before announcing it:

```bash
gh run list --workflow publish-agent.yml --limit 1
gh release view agent-v0.1.1
curl --fail https://cdn.orvo.sh/agent/channels/stable.txt
```

Never move or reuse a published tag. If a release is faulty, fix it in a new
patch version. Until a separate prerelease channel exists, do not push release
candidate tags because every matching tag is promoted to stable.

### Release notes

The workflow currently uses GitHub-generated notes. Because this is a monorepo,
those notes can include unrelated changes. Before the next release, the release
flow should move to checked-in, agent-specific notes with this structure:

- Summary
- Added or changed
- Fixed
- Upgrade notes
- Known issues

The GitHub Release description should use those notes instead of relying only on
the generated commit list.
