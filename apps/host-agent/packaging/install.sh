#!/usr/bin/env sh
set -eu

CHANNEL_URL="${ORVO_AGENT_CHANNEL_URL:-https://cdn.orvo.sh/agent/channels/stable.txt}"
INSTALL_ROOT="/usr/bin"
CONFIG_ROOT="/etc/orvo-agent"
STATE_ROOT="/var/lib/orvo-agent"
SERVICE_NAME="orvo-agent"
ENROLLMENT_TOKEN=""

fail() {
  printf 'orvo-agent: %s\n' "$*" >&2
  exit 1
}

usage() {
  printf '%s\n' 'Usage: install.sh --enrollment-token <token>'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
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

[ -n "$ENROLLMENT_TOKEN" ] || fail 'missing --enrollment-token'
[ "$(uname -s)" = "Linux" ] || fail 'the production installer currently supports Linux only'
[ "$(id -u)" -eq 0 ] || fail 'run this installer with sudo or as root'

for command_name in curl sha256sum tar systemctl useradd; do
  command -v "$command_name" >/dev/null 2>&1 || fail "missing required command: $command_name"
done

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

curl --proto '=https' --tlsv1.2 -fsSL "$CHANNEL_URL" -o "$TMP_DIR/channel.txt"
VERSION="$(sed -n 's/^version=//p' "$TMP_DIR/channel.txt")"
URL="$(sed -n "s/^linux_${ARCH}_url=//p" "$TMP_DIR/channel.txt")"
SHA256="$(sed -n "s/^linux_${ARCH}_sha256=//p" "$TMP_DIR/channel.txt")"

[ -n "$VERSION" ] || fail 'release manifest is missing version'
[ -n "$URL" ] || fail "release manifest does not contain linux_${ARCH}"
[ -n "$SHA256" ] || fail "release manifest does not contain a checksum for linux_${ARCH}"

printf 'orvo-agent: downloading %s for linux/%s\n' "$VERSION" "$ARCH"
curl --proto '=https' --tlsv1.2 -fsSL "$URL" -o "$TMP_DIR/orvo-agent.tar.gz"
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
