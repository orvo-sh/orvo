[] Refine logs and traces page
[] Make sure link to active trace in logs work
[] Add button to go to logs during a trace
[] Look into adding icons on traces!
[] Truncate span name in span-detail-panel
[] Auxiliary pages like new org new app plans switch org etc should have. aheader with the option to log out
[] Fix continue with GitHub
[] Add logo to our emails - spruce them up generally
[] organzations/plan is not redirecting to the next step, is giving the error: failed to create new trial or something
[] Fix card showing nothing but shadow in heartbeats page hen its empty state
[] Heartbeat checkins should have an expires_At too with a TTL
[] Create service map that has icons for different types of things
[] Simplify pricing, change retention for metrics to be more
[] Create derived metrics. There is already a codex plan for it

## Host agent releases and automatic updates

- [ ] Keep the host agent in the monorepo while its enrollment protocol, metric
      identity, dashboard, and backend APIs are evolving together. Reconsider a
      separate repository only if it develops an independent team, public
      contributor community, security boundary, or substantially different
      release cadence.
- [ ] Add an agent-specific changelog and require every release PR to include a
      curated summary, user-visible changes, fixes, upgrade notes, and known
      issues. Use these notes for the GitHub Release instead of monorepo-wide
      generated notes.
- [ ] Harden the release workflow so it validates the `agent-vX.Y.Z` tag, checks
      that the tagged commit is on `main`, builds and smoke-tests every supported
      platform, creates a draft GitHub Release, uploads immutable artifacts, and
      only then promotes a channel.
- [ ] Add separate `stable` and `beta` channels. Never promote prerelease tags to
      stable automatically, and add a manual promotion/rollback workflow that can
      point a channel back to an existing immutable version.
- [ ] Replace the text channel file with a versioned JSON manifest containing the
      release version, publication time, channel, per-platform URL, archive size,
      SHA-256 digest, minimum supported updater version, rollout controls, and
      manifest schema version.
- [ ] Sign update manifests and embed the verification public key in
      `orvo-agentctl`. Document signing-key rotation and emergency revocation.
      Keep GitHub artifact attestations for public build provenance, but do not
      rely on a checksum delivered by the same unsigned manifest as the only
      unattended-update verification.
- [ ] Change the installation layout to versioned directories such as
      `/opt/orvo-agent/versions/<version>` with an atomic `current` symlink.
      Preserve `/etc/orvo-agent` and `/var/lib/orvo-agent` across upgrades, retain
      at least the previous working version, and clean up older versions safely.
- [ ] Implement `orvo-agentctl update` with `--check`, `--version`, `--channel`,
      and `--rollback` options. It should lock against concurrent updates, check
      disk space, download to a temporary directory, verify the signed manifest
      and archive digest, validate the new collector configuration, and only then
      switch versions.
- [ ] Add automatic health-based rollback. After switching versions, restart the
      service and monitor its local health endpoint for a bounded period. Restore
      the previous symlink and restart the old version if validation, startup, or
      health checks fail.
- [ ] Run updates through a separate root-owned systemd oneshot service and timer;
      keep the telemetry collector itself unprivileged. Check periodically with
      randomized delay, exponential retry, a global update lock, and no tight
      polling when the CDN or network is unavailable.
- [ ] Add update configuration with simple defaults:
      `ORVO_AGENT_AUTO_UPDATE=true`, `ORVO_AGENT_UPDATE_CHANNEL=stable`, an
      optional maintenance window, and a version pin. Enrollment should configure
      safe defaults automatically while still allowing operators to opt out.
- [ ] Report the running agent version, update channel, last update check, pending
      version, update state, and sanitized failure reason to Orvo. Show
      `Up to date`, `Update available`, `Updating`, `Rolled back`, and `Failed`
      states on the Hosts page.
- [ ] Add fleet rollout controls after local automatic updates are stable:
      deterministic cohorts based on agent ID, percentage rollouts, maintenance
      windows, pause/resume, a minimum supported version, and an emergency block
      for a faulty release. Start with a small cohort before broad promotion.
- [ ] Ensure updates never discard queued telemetry or credentials and do not stop
      the running collector until the replacement has been fully downloaded and
      verified. Handle interrupted downloads, disk-full conditions, invalid
      signatures, incompatible configuration, and power loss safely.
- [ ] Add updater tests covering manifest parsing, semantic-version comparison,
      signature and digest verification, channel selection, locking, atomic
      switching, health failure, rollback, interrupted downloads, and corrupted
      archives. Add Linux systemd smoke tests for amd64 and arm64 release bundles.
- [ ] Document manual update, rollback, version pinning, proxy use, air-gapped
      installation, update logs, and recovery when both the new version and
      automatic rollback fail.
- [ ] Verify the `agent-v0.1.0` workflow, GitHub Release assets, checksums,
      attestations, CDN stable manifest, and a clean Linux installation before
      announcing the first agent release.
