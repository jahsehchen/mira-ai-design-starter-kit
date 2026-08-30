#!/usr/bin/env bash
set -euo pipefail

PROFILE="production"
if [[ "${1:-}" == "--profile" ]]; then PROFILE="${2:-production}"; fi
if [[ "${1:-}" == --profile=* ]]; then PROFILE="${1#*=}"; fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ "$PROFILE" == "dev" ]]; then
  if [[ ! -f .env ]]; then cp .env.example .env; fi
  npm install
  npm run build:contracts
  npm run dev
  exit $?
fi

if [[ "$PROFILE" != "production" ]]; then
  echo "Unknown profile: $PROFILE" >&2
  exit 2
fi

command -v docker >/dev/null 2>&1 || { echo "Docker is required." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required to generate production secrets." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required for the health check." >&2; exit 1; }

if [[ ! -f .env.production ]]; then
  cp .env.production.example .env.production
fi

env_get() { grep -E "^$1=" .env.production | head -1 | cut -d= -f2-; }
replace_value() {
  local key="$1" value="$2"
  sed -i.bak -E "s|^${key}=.*|${key}=${value}|" .env.production
  rm -f .env.production.bak
}
generate_if_placeholder() {
  local key="$1" current
  current="$(env_get "$key")"
  if [[ -z "$current" || "$current" == *CHANGE_ME* ]]; then
    replace_value "$key" "$(openssl rand -hex 32)"
  fi
}

generate_if_placeholder DB_PASSWORD
generate_if_placeholder JWT_ACCESS_SECRET
generate_if_placeholder JWT_REFRESH_SECRET
generate_if_placeholder PAYMENT_MOCK_TOKEN

WEB_PORT="$(env_get WEB_PORT)"
WEB_PORT="${WEB_PORT:-8080}"

docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build

health_url="http://localhost:${WEB_PORT}/api/v1/health"
for _ in $(seq 1 40); do
  if curl -fsS "$health_url" 2>/dev/null | grep -q '"db":"up"'; then
    echo "MIRA starter is ready: http://localhost:${WEB_PORT}"
    echo "Register a new local account to begin. No production demo account is pre-created."
    exit 0
  fi
  sleep 3
done

echo "Health check timed out: $health_url" >&2
docker compose --env-file .env.production ps >&2
exit 1
