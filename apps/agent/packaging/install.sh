#!/usr/bin/env sh
set -eu

RELEASE_BASE_URL="${ORVO_AGENT_RELEASE_BASE_URL:-https://github.com/orvo-sh/orvo/releases/download}"
INSTALL_ROOT="/usr/bin"
CONFIG_ROOT="/etc/orvo-agent"
STATE_ROOT="/var/lib/orvo-agent"
SERVICE_NAME="orvo-agent"
VERSION=""
ENROLLMENT_TOKEN=""

fail() {
  printf 'orvo-agent: %s\n' "$*" >&2
  exit 1
}

usage() {
  printf '%s\n' 'Usage: install.sh --version <version> --enrollment-token <token>'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      [ "$#" -ge 2 ] || fail '--version requires a value'
      VERSION="$2"
      shift 2
      ;;
    --enrollment-token)
      [ "$#" -ge 2 ] || fail '--enrollment-token requires a value'
      ENROLLMENT_TOKEN="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

[ -n "$VERSION" ] || fail 'missing --version'
printf '%s\n' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' \
  || fail 'version must match X.Y.Z'
[ -n "$ENROLLMENT_TOKEN" ] || fail 'missing --enrollment-token'
[ "$(uname -s)" = "Linux" ] || fail 'the production installer currently supports Linux only'
[ "$(id -u)" -eq 0 ] || fail 'run this installer with sudo or as root'

for command_name in awk curl grep sha256sum tar systemctl useradd; do
  command -v "$command_name" >/dev/null 2>&1 || fail "missing required command: $command_name"
done

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

RELEASE_URL="${RELEASE_BASE_URL%/}/agent-v${VERSION}"
ASSET_NAME="orvo-agent_${VERSION}_linux_${ARCH}.tar.gz"

curl --proto '=https' --tlsv1.2 -fsSL \
  "$RELEASE_URL/checksums.txt" -o "$TMP_DIR/checksums.txt"
SHA256="$(awk -v name="$ASSET_NAME" '$2 == name { print $1 }' "$TMP_DIR/checksums.txt")"
[ -n "$SHA256" ] || fail "release checksums do not contain ${ASSET_NAME}"

printf 'orvo-agent: downloading %s for linux/%s\n' "$VERSION" "$ARCH"
curl --proto '=https' --tlsv1.2 -fsSL \
  "$RELEASE_URL/$ASSET_NAME" -o "$TMP_DIR/orvo-agent.tar.gz"
printf '%s  %s\n' "$SHA256" "$TMP_DIR/orvo-agent.tar.gz" | sha256sum -c - >/dev/null \
  || fail 'artifact checksum verification failed'

tar -xzf "$TMP_DIR/orvo-agent.tar.gz" -C "$TMP_DIR"

if ! id -u orvo-agent >/dev/null 2>&1; then
  useradd --system --home-dir "$STATE_ROOT" --shell /usr/sbin/nologin orvo-agent
fi

install -d -o root -g root -m 0755 "$CONFIG_ROOT"
install -d -o orvo-agent -g orvo-agent -m 0750 "$STATE_ROOT" "$STATE_ROOT/queue"
install -o root -g root -m 0755 "$TMP_DIR/orvo-agent" "$INSTALL_ROOT/orvo-agent"
install -o root -g root -m 0755 "$TMP_DIR/orvo-agentctl" "$INSTALL_ROOT/orvo-agentctl"
install -o root -g root -m 0644 "$TMP_DIR/orvo-agent.service" "/etc/systemd/system/$SERVICE_NAME.service"

if ! "$INSTALL_ROOT/orvo-agentctl" enroll \
  --token "$ENROLLMENT_TOKEN" \
  --config-dir "$CONFIG_ROOT" \
  --state-dir "$STATE_ROOT"; then
  fail 'enrollment failed; the service was installed but was not started'
fi

chown -R orvo-agent:orvo-agent "$STATE_ROOT"
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME.service"

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:13133/ >/dev/null 2>&1; then
    printf 'orvo-agent: installed and running as %s\n' "$SERVICE_NAME.service"
    exit 0
  fi
  sleep 1
done

journalctl -u "$SERVICE_NAME.service" --no-pager -n 50 >&2 || true
fail 'the service started but did not become healthy'
