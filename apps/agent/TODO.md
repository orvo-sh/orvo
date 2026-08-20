# Roadmap

## Releases and automatic updates

- [ ] Design automatic updates around immutable GitHub Releases without changing
      the explicitly pinned version used by fresh installations.
- [ ] Add signed release metadata containing the release version, publication
      time, per-platform URL, archive size, SHA-256 digest, minimum updater
      version, rollout controls, and schema version.
- [ ] Embed the metadata verification public key in `orvo-agentctl`. Document
      signing-key rotation and emergency revocation.
- [ ] Change installation to versioned directories under
      `/opt/orvo-agent/versions/<version>` with an atomic `current` symlink.
      Preserve configuration, credentials, state, and queued telemetry across
      upgrades and retain the previous working version.
- [ ] Implement `orvo-agentctl update` with `--check`, `--version`, `--channel`,
      and `--rollback`. Lock concurrent updates, check disk space, download to a
      temporary directory, verify the signed manifest and archive digest,
      validate the new collector configuration, and only then switch versions.
- [ ] Add automatic health-based rollback. Restart the new version, monitor its
      health for a bounded period, and restore the previous version if validation,
      startup, or health checks fail.
- [ ] Run updates through a separate root-owned systemd oneshot service and timer
      while keeping the telemetry collector unprivileged. Use randomized delay,
      exponential retry, and a global update lock.
- [ ] Add simple update configuration with safe defaults:
      `ORVO_AGENT_AUTO_UPDATE=true`, `ORVO_AGENT_UPDATE_CHANNEL=stable`, an
      optional maintenance window, and a version pin.
- [ ] Report the current agent version, channel, last update check, pending
      version, update state, and sanitized failure reason to Orvo.
- [ ] Add fleet rollout controls after local updates are stable: deterministic
      cohorts, percentage rollouts, maintenance windows, pause/resume, minimum
      supported versions, and an emergency release block.
- [ ] Handle interrupted downloads, disk-full conditions, invalid signatures,
      incompatible configuration, network loss, and power loss without stopping
      the current collector or losing queued telemetry.
- [ ] Test manifest parsing, semantic-version comparison, signature and digest
      verification, locking, atomic switching, health failure, rollback,
      interrupted downloads, and corrupted archives. Add Linux systemd smoke
      tests for amd64 and arm64 release bundles.
- [ ] Document manual updates, rollback, version pinning, proxy use, air-gapped
      installation, update logs, and recovery when automatic rollback fails.
