#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly NODE_VERSION="$(tr -d '[:space:]' < "${PROJECT_ROOT}/.node-version")"
readonly PNPM_VERSION="$(
  sed -n 's/.*"packageManager": "pnpm@\([^"]*\)".*/\1/p' \
    "${PROJECT_ROOT}/package.json"
)"
readonly NODE_INSTALL_ROOT="${XDG_DATA_HOME:-${HOME}/.local/share}/local-market"
readonly NODE_INSTALL_DIR="${NODE_INSTALL_ROOT}/node-v${NODE_VERSION}"
readonly NODE_BIN_DIR="${NODE_INSTALL_DIR}/bin"

log() {
  printf '\n\033[1;34m==>\033[0m %s\n' "$1"
}

fail() {
  printf '\nErreur : %s\n' "$1" >&2
  exit 1
}

run_as_root() {
  sudo "$@"
}

require_supported_system() {
  [[ -r /etc/os-release ]] || fail "Impossible d'identifier le système."

  # shellcheck disable=SC1091
  source /etc/os-release

  case "${ID:-}" in
    ubuntu | debian) ;;
    *) fail "Ce script prend uniquement en charge Ubuntu et Debian." ;;
  esac

  [[ -n "${VERSION_CODENAME:-}" ]] ||
    fail "La version de la distribution ne fournit pas VERSION_CODENAME."

  DISTRO_ID="${ID}"
  DISTRO_CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME}}"
}

validate_project_versions() {
  [[ "${NODE_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
    fail "Version Node.js invalide dans .node-version."
  [[ "${PNPM_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
    fail "Version pnpm invalide dans package.json."
}

require_unprivileged_user() {
  ((EUID != 0)) ||
    fail "Lancez ce script sans sudo ; il demandera sudo lorsque nécessaire."
  command -v sudo >/dev/null 2>&1 ||
    fail "La commande sudo est requise pour installer les paquets système."
}

install_system_prerequisites() {
  log "Installation des prérequis système"
  run_as_root apt-get update
  run_as_root apt-get install -y ca-certificates curl git gnupg xz-utils
}

install_docker() {
  if command -v docker >/dev/null 2>&1 &&
    docker compose version >/dev/null 2>&1; then
    log "Docker et Docker Compose sont déjà installés"
    return
  fi

  log "Installation de Docker et Docker Compose"

  local keyring_dir="/etc/apt/keyrings"
  local docker_key="${keyring_dir}/docker.asc"
  local docker_sources="/etc/apt/sources.list.d/docker.sources"
  local architecture
  local temporary_sources

  architecture="$(dpkg --print-architecture)"
  temporary_sources="$(mktemp)"
  trap 'rm -f -- "${temporary_sources:-}"' RETURN

  run_as_root install -m 0755 -d "${keyring_dir}"
  curl --fail --silent --show-error --location \
    "https://download.docker.com/linux/${DISTRO_ID}/gpg" |
    run_as_root tee "${docker_key}" >/dev/null
  run_as_root chmod a+r "${docker_key}"

  printf '%s\n' \
    "Types: deb" \
    "URIs: https://download.docker.com/linux/${DISTRO_ID}" \
    "Suites: ${DISTRO_CODENAME}" \
    "Components: stable" \
    "Architectures: ${architecture}" \
    "Signed-By: ${docker_key}" >"${temporary_sources}"
  run_as_root install -m 0644 "${temporary_sources}" "${docker_sources}"

  run_as_root apt-get update
  run_as_root apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
}

configure_docker_access() {
  local current_user

  current_user="$(id -un)"
  if id -nG "${current_user}" | tr ' ' '\n' | grep -qx docker; then
    return
  fi

  log "Ajout de ${current_user} au groupe docker"
  run_as_root usermod -aG docker "${current_user}"
  DOCKER_GROUP_CHANGED=true
}

node_archive_architecture() {
  case "$(uname -m)" in
    x86_64) printf 'x64\n' ;;
    aarch64 | arm64) printf 'arm64\n' ;;
    *) fail "Architecture Node.js non prise en charge : $(uname -m)." ;;
  esac
}

install_node() {
  if [[ -x "${NODE_BIN_DIR}/node" ]] &&
    [[ "$("${NODE_BIN_DIR}/node" --version)" == "v${NODE_VERSION}" ]]; then
    log "Node.js ${NODE_VERSION} est déjà installé pour ce projet"
    return
  fi

  [[ ! -e "${NODE_INSTALL_DIR}" ]] ||
    fail "${NODE_INSTALL_DIR} existe mais ne contient pas Node.js ${NODE_VERSION}."

  log "Installation de Node.js ${NODE_VERSION}"

  local architecture
  local archive_name
  local download_url
  local temporary_dir

  architecture="$(node_archive_architecture)"
  archive_name="node-v${NODE_VERSION}-linux-${architecture}.tar.xz"
  download_url="https://nodejs.org/dist/v${NODE_VERSION}"
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf -- "${temporary_dir:-}"' RETURN

  curl --fail --silent --show-error --location \
    --output "${temporary_dir}/${archive_name}" \
    "${download_url}/${archive_name}"
  curl --fail --silent --show-error --location \
    --output "${temporary_dir}/SHASUMS256.txt" \
    "${download_url}/SHASUMS256.txt"

  (
    cd "${temporary_dir}"
    grep "  ${archive_name}\$" SHASUMS256.txt | sha256sum --check -
  )

  mkdir -p "${temporary_dir}/node"
  tar --extract \
    --xz \
    --file "${temporary_dir}/${archive_name}" \
    --directory "${temporary_dir}/node" \
    --strip-components=1
  mkdir -p "${NODE_INSTALL_ROOT}"
  mv "${temporary_dir}/node" "${NODE_INSTALL_DIR}"
}

configure_node_path() {
  local profile_file="${HOME}/.profile"
  local path_line="export PATH=\"${NODE_BIN_DIR}:\$PATH\""

  touch "${profile_file}"
  if ! grep -Fqx "${path_line}" "${profile_file}"; then
    {
      printf '\n# Environnement Node.js de Local Market\n'
      printf '%s\n' "${path_line}"
    } >>"${profile_file}"
  fi

  export PATH="${NODE_BIN_DIR}:${PATH}"
}

install_pnpm_and_dependencies() {
  log "Activation de pnpm ${PNPM_VERSION}"
  corepack enable pnpm
  corepack install --global "pnpm@${PNPM_VERSION}"

  [[ "$(node --version)" == "v${NODE_VERSION}" ]] ||
    fail "La version active de Node.js n'est pas v${NODE_VERSION}."
  [[ "$(pnpm --version)" == "${PNPM_VERSION}" ]] ||
    fail "La version active de pnpm n'est pas ${PNPM_VERSION}."

  log "Installation reproductible des dépendances du projet"
  (
    cd "${PROJECT_ROOT}"
    pnpm install --frozen-lockfile
  )
}

prepare_environment_file() {
  if [[ -e "${PROJECT_ROOT}/.env" ]]; then
    log "Le fichier .env existe déjà, il est conservé"
    return
  fi

  [[ -f "${PROJECT_ROOT}/.env.example" ]] ||
    fail "Le fichier .env.example est introuvable."

  log "Création de .env à partir de .env.example"
  cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
}

print_summary() {
  printf '\n\033[1;32mEnvironnement installé avec succès.\033[0m\n'
  printf 'Node.js : %s\n' "$(node --version)"
  printf 'pnpm    : %s\n' "$(pnpm --version)"
  printf 'Docker  : %s\n' "$(docker --version)"
  printf 'Compose : %s\n' "$(docker compose version)"

  if [[ "${DOCKER_GROUP_CHANGED}" == true ]]; then
    printf '\nDéconnectez-vous puis reconnectez-vous pour utiliser Docker sans sudo.\n'
  else
    printf '\nPour activer Node.js dans le terminal actuel :\n'
    printf '  source %q\n' "${HOME}/.profile"
  fi

  printf '\nPour lancer le projet :\n'
  printf '  cd %q\n' "${PROJECT_ROOT}"
  printf '  docker compose up --build\n'
}

main() {
  local DISTRO_ID
  local DISTRO_CODENAME
  local DOCKER_GROUP_CHANGED=false

  validate_project_versions
  require_unprivileged_user
  require_supported_system
  install_system_prerequisites
  install_docker
  configure_docker_access
  install_node
  configure_node_path
  install_pnpm_and_dependencies
  prepare_environment_file
  print_summary
}

main "$@"
