#!/usr/bin/env bash
set -euo pipefail

COLLECTOR_VERSION="{{COLLECTOR_VERSION}}"
INSTALLER_SERVICE_NAME="{{INSTALLER_SERVICE_NAME}}"
INSTALLER_USER="{{INSTALLER_USER}}"
INSTALL_ROOT="{{INSTALL_ROOT}}"
CONFIG_ROOT="{{CONFIG_ROOT}}"
STATE_ROOT="{{STATE_ROOT}}"
BINARY_NAME="{{BINARY_NAME}}"
HEALTH_CHECK_ENDPOINT="127.0.0.1:13133"

fail() {
  echo "orvo-host-agent: $*" >&2
  exit 1
}

require_linux() {
  [[ "$(uname -s)" == "Linux" ]] || fail "this installer only supports Linux hosts with systemd"
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
  install.sh --uninstall [--purge]
EOF
}

parse_args() {
  BUNDLE_URL=""
  UNINSTALL="false"
  PURGE="false"

  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --bundle-url)
        [[ "$#" -ge 2 ]] || fail "--bundle-url requires a value"
        BUNDLE_URL="$2"
        shift 2
        ;;
      --uninstall)
        UNINSTALL="true"
        shift
        ;;
      --purge)
        PURGE="true"
        shift
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

  if [[ "${UNINSTALL}" == "true" ]]; then
    [[ -z "${BUNDLE_URL}" ]] || fail "--bundle-url cannot be used with --uninstall"
    return
  fi

  [[ -n "${BUNDLE_URL}" ]] || fail "missing --bundle-url"
  [[ "${PURGE}" == "false" ]] || fail "--purge can only be used with --uninstall"
}

validate_bundle_url() {
  [[ "${BUNDLE_URL}" =~ ^https://([[:alnum:]-]+\.)*orvo\.sh([/?#:].*)?$ ]] && return 0
  [[ "${BUNDLE_URL}" =~ ^http://(localhost|127\.0\.0\.1|\[::1\])([/?#:].*)?$ ]] && return 0
  fail "bundle url must be served from orvo.sh or a local development host"
}

download_bundle() {
  local bundle_path="$1"
  curl -fsSL "${BUNDLE_URL}" -o "${bundle_path}"
}

parse_bundle() {
  local bundle_path="$1"
  local line

  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line}" ]] && continue
    [[ "${line}" =~ ^# ]] && continue

    if [[ "${line}" =~ ^([A-Z0-9_]+)=\'([^\']*)\'$ ]]; then
      local name="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"

      case "${name}" in
        ORVO_INSTALL_BUNDLE_VERSION|ORVO_OTELCOL_VERSION|ORVO_APP_ID|ORVO_DOCKER_ENABLED|ORVO_INSTALLER_SERVICE_NAME|ORVO_INSTALLER_USER|ORVO_INSTALL_ROOT|ORVO_CONFIG_ROOT|ORVO_STATE_ROOT|ORVO_BINARY_NAME|ORVO_OTELCOL_CONFIG_B64|ORVO_SYSTEMD_UNIT_B64|ORVO_ENV_FILE_B64)
          printf -v "${name}" '%s' "${value}"
          ;;
        *)
          fail "unsupported bundle variable: ${name}"
          ;;
      esac
    else
      fail "invalid bundle format"
    fi
  done < "${bundle_path}"
}

validate_bundle() {
  : "${ORVO_INSTALL_BUNDLE_VERSION:?missing ORVO_INSTALL_BUNDLE_VERSION}"
  : "${ORVO_OTELCOL_VERSION:?missing ORVO_OTELCOL_VERSION}"
  : "${ORVO_APP_ID:?missing ORVO_APP_ID}"
  : "${ORVO_DOCKER_ENABLED:?missing ORVO_DOCKER_ENABLED}"
  : "${ORVO_INSTALLER_SERVICE_NAME:?missing ORVO_INSTALLER_SERVICE_NAME}"
  : "${ORVO_INSTALLER_USER:?missing ORVO_INSTALLER_USER}"
  : "${ORVO_INSTALL_ROOT:?missing ORVO_INSTALL_ROOT}"
  : "${ORVO_CONFIG_ROOT:?missing ORVO_CONFIG_ROOT}"
  : "${ORVO_STATE_ROOT:?missing ORVO_STATE_ROOT}"
  : "${ORVO_BINARY_NAME:?missing ORVO_BINARY_NAME}"
  : "${ORVO_OTELCOL_CONFIG_B64:?missing ORVO_OTELCOL_CONFIG_B64}"
  : "${ORVO_SYSTEMD_UNIT_B64:?missing ORVO_SYSTEMD_UNIT_B64}"
  : "${ORVO_ENV_FILE_B64:?missing ORVO_ENV_FILE_B64}"

  [[ "${ORVO_DOCKER_ENABLED}" == "true" || "${ORVO_DOCKER_ENABLED}" == "false" ]] \
    || fail "ORVO_DOCKER_ENABLED must be true or false"
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
  chown root:root "${INSTALL_ROOT}" "${CONFIG_ROOT}"
  chmod 0755 "${INSTALL_ROOT}" "${CONFIG_ROOT}"
  chown -R "${INSTALLER_USER}:${INSTALLER_USER}" "${STATE_ROOT}"
  chmod 0750 "${STATE_ROOT}"
}

group_exists() {
  local group_name="$1"

  if command -v getent >/dev/null 2>&1; then
    getent group "${group_name}" >/dev/null 2>&1
    return
  fi

  grep -q "^${group_name}:" /etc/group
}

configure_docker_access_if_needed() {
  [[ "${ORVO_DOCKER_ENABLED}" == "true" ]] || return

  require_command usermod
  group_exists docker || fail "docker monitoring requires a local docker group with access to /var/run/docker.sock"
  usermod -aG docker "${INSTALLER_USER}"
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

  install -o root -g root -m 0755 "${binary_path}" "${INSTALL_ROOT}/${BINARY_NAME}"
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

  chown root:root "${CONFIG_ROOT}/otelcol.yaml" \
    "${CONFIG_ROOT}/${INSTALLER_SERVICE_NAME}.env" \
    "/etc/systemd/system/${INSTALLER_SERVICE_NAME}.service"
  chmod 0644 "${CONFIG_ROOT}/otelcol.yaml" "/etc/systemd/system/${INSTALLER_SERVICE_NAME}.service"
  chmod 0600 "${CONFIG_ROOT}/${INSTALLER_SERVICE_NAME}.env"
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

  local attempt
  for attempt in $(seq 1 10); do
    if curl -fsS "http://${HEALTH_CHECK_ENDPOINT}/" >/dev/null 2>&1; then
      return
    fi

    sleep 1
  done

  journalctl -u "${INSTALLER_SERVICE_NAME}.service" --no-pager -n 50 >&2 || true
  fail "collector health check failed at ${HEALTH_CHECK_ENDPOINT}"
}

uninstall_service() {
  if systemctl list-unit-files "${INSTALLER_SERVICE_NAME}.service" >/dev/null 2>&1; then
    systemctl disable --now "${INSTALLER_SERVICE_NAME}.service" >/dev/null 2>&1 || true
  fi

  rm -f "/etc/systemd/system/${INSTALLER_SERVICE_NAME}.service"
  rm -rf "${INSTALL_ROOT}" "${CONFIG_ROOT}"

  if [[ "${PURGE}" == "true" ]]; then
    rm -rf "${STATE_ROOT}"
    id -u "${INSTALLER_USER}" >/dev/null 2>&1 && userdel "${INSTALLER_USER}" >/dev/null 2>&1 || true
  fi

  systemctl daemon-reload
  if [[ "${PURGE}" == "true" ]]; then
    echo "orvo-host-agent: removed ${INSTALLER_SERVICE_NAME} with purge"
    return
  fi

  echo "orvo-host-agent: removed ${INSTALLER_SERVICE_NAME}"
}

main() {
  require_linux
  require_root
  require_command curl
  require_command systemctl
  parse_args "$@"

  if [[ "${UNINSTALL}" == "true" ]]; then
    uninstall_service
    exit 0
  fi

  require_command tar
  require_command base64

  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "${temp_dir}"' EXIT

  local bundle_path="${temp_dir}/install-bundle.env"
  validate_bundle_url
  download_bundle "${bundle_path}"
  parse_bundle "${bundle_path}"
  validate_bundle

  local arch
  arch="$(detect_arch)"

  create_user_if_needed
  install_directories
  configure_docker_access_if_needed
  download_collector "${arch}" "${temp_dir}"

  ORVO_HOST_ID="$(resolve_host_id)"
  ORVO_HOST_NAME="$(resolve_host_name)"
  write_rendered_files
  start_service
  validate_startup

  echo "orvo-host-agent: installed ${INSTALLER_SERVICE_NAME} for app ${ORVO_APP_ID}"
}

main "$@"
