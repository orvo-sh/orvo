#!/usr/bin/env bash
set -euo pipefail

COLLECTOR_VERSION="{{COLLECTOR_VERSION}}"
INSTALLER_SERVICE_NAME="{{INSTALLER_SERVICE_NAME}}"
INSTALLER_USER="{{INSTALLER_USER}}"
INSTALL_ROOT="{{INSTALL_ROOT}}"
CONFIG_ROOT="{{CONFIG_ROOT}}"
STATE_ROOT="{{STATE_ROOT}}"
BINARY_NAME="{{BINARY_NAME}}"

fail() {
  echo "orvo-host-agent: $*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "run this installer with sudo or as root"
  fi
}

require_command() {
  local command_name="$1"
  command -v "${command_name}" >/dev/null 2>&1 || fail "missing required command: ${command_name}"
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)
      echo "amd64"
      ;;
    aarch64|arm64)
      echo "arm64"
      ;;
    *)
      fail "unsupported architecture: $(uname -m)"
      ;;
  esac
}

usage() {
  cat <<'EOF'
Usage:
  install.sh --bundle-url <url>
EOF
}

parse_args() {
  BUNDLE_URL=""

  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --bundle-url)
        [[ "$#" -ge 2 ]] || fail "--bundle-url requires a value"
        BUNDLE_URL="$2"
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

  [[ -n "${BUNDLE_URL}" ]] || fail "missing --bundle-url"
}

download_bundle() {
  local bundle_path="$1"
  curl -fsSL "${BUNDLE_URL}" -o "${bundle_path}"
}

create_user_if_needed() {
  if ! id -u "${INSTALLER_USER}" >/dev/null 2>&1; then
    useradd \
      --system \
      --home-dir "${STATE_ROOT}" \
      --shell /usr/sbin/nologin \
      "${INSTALLER_USER}"
  fi
}

resolve_host_id() {
  if [[ -f /etc/machine-id ]]; then
    tr -d '\n' </etc/machine-id
    return
  fi

  if [[ -f /var/lib/dbus/machine-id ]]; then
    tr -d '\n' </var/lib/dbus/machine-id
    return
  fi

  fail "could not resolve a stable host id from machine-id"
}

resolve_host_name() {
  hostnamectl --static 2>/dev/null || hostname
}

install_directories() {
  mkdir -p "${INSTALL_ROOT}" "${CONFIG_ROOT}" "${STATE_ROOT}"
  chown -R "${INSTALLER_USER}:${INSTALLER_USER}" "${STATE_ROOT}"
}

download_collector() {
  local arch="$1"
  local temp_dir="$2"
  local tarball_path="${temp_dir}/otelcol-contrib.tar.gz"
  local extracted_dir="${temp_dir}/otelcol"
  local candidates=(
    "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${COLLECTOR_VERSION}/otelcol-contrib_${COLLECTOR_VERSION}_linux_${arch}.tar.gz"
    "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${COLLECTOR_VERSION}/otelcol-contrib_v${COLLECTOR_VERSION}_linux_${arch}.tar.gz"
  )

  local downloaded="false"
  for url in "${candidates[@]}"; do
    if curl -fsSL "${url}" -o "${tarball_path}"; then
      downloaded="true"
      break
    fi
  done

  [[ "${downloaded}" == "true" ]] || fail "failed to download OpenTelemetry Collector ${COLLECTOR_VERSION}"

  rm -rf "${extracted_dir}"
  mkdir -p "${extracted_dir}"
  tar -xzf "${tarball_path}" -C "${extracted_dir}"

  local binary_path
  binary_path="$(find "${extracted_dir}" -type f -name "${BINARY_NAME}" | head -n 1)"
  [[ -n "${binary_path}" ]] || fail "collector binary not found in archive"

  install -m 0755 "${binary_path}" "${INSTALL_ROOT}/${BINARY_NAME}"
}

write_file_from_bundle() {
  local output_path="$1"
  local encoded="$2"
  printf '%s' "${encoded}" | base64 --decode > "${output_path}"
}

write_rendered_files() {
  export ORVO_HOST_ID
  export ORVO_HOST_NAME

  write_file_from_bundle "${CONFIG_ROOT}/otelcol.yaml" "${ORVO_OTELCOL_CONFIG_B64}"
  write_file_from_bundle "${CONFIG_ROOT}/${INSTALLER_SERVICE_NAME}.env" "${ORVO_ENV_FILE_B64}"
  write_file_from_bundle "/etc/systemd/system/${INSTALLER_SERVICE_NAME}.service" "${ORVO_SYSTEMD_UNIT_B64}"

  {
    echo "ORVO_HOST_ID=${ORVO_HOST_ID}"
    echo "ORVO_HOST_NAME=${ORVO_HOST_NAME}"
  } >> "${CONFIG_ROOT}/${INSTALLER_SERVICE_NAME}.env"
}

start_service() {
  systemctl daemon-reload
  systemctl enable --now "${INSTALLER_SERVICE_NAME}.service"
}

validate_startup() {
  systemctl is-active --quiet "${INSTALLER_SERVICE_NAME}.service" || {
    journalctl -u "${INSTALLER_SERVICE_NAME}.service" --no-pager -n 50 >&2 || true
    fail "service failed to start"
  }
}

main() {
  require_root
  require_command curl
  require_command tar
  require_command base64
  require_command systemctl
  parse_args "$@"

  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "${temp_dir}"' EXIT

  local bundle_path="${temp_dir}/install-bundle.env"
  download_bundle "${bundle_path}"
  # shellcheck source=/dev/null
  source "${bundle_path}"

  local arch
  arch="$(detect_arch)"

  create_user_if_needed
  install_directories
  download_collector "${arch}" "${temp_dir}"

  ORVO_HOST_ID="$(resolve_host_id)"
  ORVO_HOST_NAME="$(resolve_host_name)"
  write_rendered_files
  start_service
  validate_startup

  echo "orvo-host-agent: installed ${INSTALLER_SERVICE_NAME} for app ${ORVO_APP_ID}"
}

main "$@"
