#!/usr/bin/env bash
# Funciones compartidas para scripts OpenWA

read_env() {
  local env_file="$1"
  local key="$2"
  local default="${3:-}"
  if [ -f "$env_file" ]; then
    local line
    line="$(grep -E "^${key}=" "$env_file" | tail -1 || true)"
    if [ -n "$line" ]; then
      echo "${line#*=}" | tr -d '"'
      return
    fi
  fi
  echo "$default"
}

set_env_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$env_file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    echo "${key}=${value}" >> "$env_file"
  fi
}

resolve_openwa_api_key() {
  local root_dir="$1"
  local env_file="$2"
  local key
  key="$(read_env "$env_file" OPENWA_API_KEY "")"
  if [ -z "$key" ] && [ -f "$root_dir/openwa-gateway/data/.api-key" ]; then
    key="$(tr -d '[:space:]' < "$root_dir/openwa-gateway/data/.api-key")"
  fi
  if [ -z "$key" ]; then
    key="dev-admin-key"
  fi
  echo "$key"
}

resolve_session_id() {
  local openwa_url="$1"
  local api_key="$2"
  local session_name="$3"

  curl -sf "$openwa_url/api/sessions" -H "X-API-Key: $api_key" | node -e "
const sessions = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const name = process.argv[1];
const found = sessions.find((s) => s.name === name);
if (!found) {
  console.error('Sesión no encontrada: ' + name);
  process.exit(1);
}
console.log(found.id);
" "$session_name"
}

ensure_session() {
  local openwa_url="$1"
  local api_key="$2"
  local session_name="$3"

  local existing
  existing="$(curl -sf "$openwa_url/api/sessions" -H "X-API-Key: $api_key" | node -e "
const sessions = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const found = sessions.find((s) => s.name === process.argv[1]);
if (found) console.log(found.id);
" "$session_name" 2>/dev/null || true)"

  if [ -n "$existing" ]; then
    echo "$existing"
    return
  fi

  curl -sf -X POST "$openwa_url/api/sessions" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $api_key" \
    -d "{\"name\":\"$session_name\"}" | node -e "
const s = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(s.id);
"
}
