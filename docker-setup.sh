#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
EXTRA_COMPOSE_FILE="$ROOT_DIR/docker-compose.extra.yml"
IMAGE_NAME="${CLAWDBOT_IMAGE:-clawdbot:local}"
EXTRA_MOUNTS="${CLAWDBOT_EXTRA_MOUNTS:-}"
HOME_VOLUME_NAME="${CLAWDBOT_HOME_VOLUME:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

require_cmd docker
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose not available (try: docker compose version)" >&2
  exit 1
fi

mkdir -p "${CLAWDBOT_CONFIG_DIR:-$HOME/.clawdbot}"
mkdir -p "${CLAWDBOT_WORKSPACE_DIR:-$HOME/clawd}"

export CLAWDBOT_CONFIG_DIR="${CLAWDBOT_CONFIG_DIR:-$HOME/.clawdbot}"
export CLAWDBOT_WORKSPACE_DIR="${CLAWDBOT_WORKSPACE_DIR:-$HOME/clawd}"
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-18789}"
export CLAWDBOT_BRIDGE_PORT="${CLAWDBOT_BRIDGE_PORT:-18790}"
export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-lan}"
export CLAWDBOT_IMAGE="$IMAGE_NAME"
export CLAWDBOT_DOCKER_APT_PACKAGES="${CLAWDBOT_DOCKER_APT_PACKAGES:-}"

if [[ -z "${CLAWDBOT_GATEWAY_TOKEN:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    CLAWDBOT_GATEWAY_TOKEN="$(openssl rand -hex 32)"
  else
    CLAWDBOT_GATEWAY_TOKEN="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
  fi
fi
export CLAWDBOT_GATEWAY_TOKEN

COMPOSE_FILES=("$COMPOSE_FILE")
COMPOSE_ARGS=()

write_extra_compose() {
  local home_volume="$1"
  shift
  local -a mounts=("$@")
  local mount

  cat >"$EXTRA_COMPOSE_FILE" <<'YAML'
services:
  clawdbot-gateway:
    volumes:
YAML

  if [[ -n "$home_volume" ]]; then
    printf '      - %s:/home/node\n' "$home_volume" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s:/home/node/.clawdbot\n' "$CLAWDBOT_CONFIG_DIR" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s:/home/node/clawd\n' "$CLAWDBOT_WORKSPACE_DIR" >>"$EXTRA_COMPOSE_FILE"
  fi

  for mount in "${mounts[@]}"; do
    printf '      - %s\n' "$mount" >>"$EXTRA_COMPOSE_FILE"
  done

  cat >>"$EXTRA_COMPOSE_FILE" <<'YAML'
  clawdbot-cli:
    volumes:
YAML

  if [[ -n "$home_volume" ]]; then
    printf '      - %s:/home/node\n' "$home_volume" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s:/home/node/.clawdbot\n' "$CLAWDBOT_CONFIG_DIR" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s:/home/node/clawd\n' "$CLAWDBOT_WORKSPACE_DIR" >>"$EXTRA_COMPOSE_FILE"
  fi

  for mount in "${mounts[@]}"; do
    printf '      - %s\n' "$mount" >>"$EXTRA_COMPOSE_FILE"
  done

  if [[ -n "$home_volume" && "$home_volume" != *"/"* ]]; then
    cat >>"$EXTRA_COMPOSE_FILE" <<YAML
volumes:
  ${home_volume}:
YAML
  fi
}

VALID_MOUNTS=()
if [[ -n "$EXTRA_MOUNTS" ]]; then
  IFS=',' read -r -a mounts <<<"$EXTRA_MOUNTS"
  for mount in "${mounts[@]}"; do
    mount="${mount#"${mount%%[![:space:]]*}"}"
    mount="${mount%"${mount##*[![:space:]]}"}"
    if [[ -n "$mount" ]]; then
      VALID_MOUNTS+=("$mount")
    fi
  done
fi

if [[ -n "$HOME_VOLUME_NAME" || ${#VALID_MOUNTS[@]} -gt 0 ]]; then
  write_extra_compose "$HOME_VOLUME_NAME" "${VALID_MOUNTS[@]}"
  COMPOSE_FILES+=("$EXTRA_COMPOSE_FILE")
fi
for compose_file in "${COMPOSE_FILES[@]}"; do
  COMPOSE_ARGS+=("-f" "$compose_file")
done
COMPOSE_HINT="docker compose"
for compose_file in "${COMPOSE_FILES[@]}"; do
  COMPOSE_HINT+=" -f ${compose_file}"
done

ENV_FILE="$ROOT_DIR/.env"
upsert_env() {
  local file="$1"
  shift
  local -a keys=("$@")
  local tmp
  tmp="$(mktemp)"
  declare -A seen=()

  if [[ -f "$file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      local key="${line%%=*}"
      local replaced=false
      for k in "${keys[@]}"; do
        if [[ "$key" == "$k" ]]; then
          printf '%s=%s\n' "$k" "${!k-}" >>"$tmp"
          seen["$k"]=1
          replaced=true
          break
        fi
      done
      if [[ "$replaced" == false ]]; then
        printf '%s\n' "$line" >>"$tmp"
      fi
    done <"$file"
  fi

  for k in "${keys[@]}"; do
    if [[ -z "${seen[$k]:-}" ]]; then
      printf '%s=%s\n' "$k" "${!k-}" >>"$tmp"
    fi
  done

  mv "$tmp" "$file"
}

upsert_env "$ENV_FILE" \
  CLAWDBOT_CONFIG_DIR \
  CLAWDBOT_WORKSPACE_DIR \
  CLAWDBOT_GATEWAY_PORT \
  CLAWDBOT_BRIDGE_PORT \
  CLAWDBOT_GATEWAY_BIND \
  CLAWDBOT_GATEWAY_TOKEN \
  CLAWDBOT_IMAGE \
  CLAWDBOT_EXTRA_MOUNTS \
  CLAWDBOT_HOME_VOLUME \
  CLAWDBOT_DOCKER_APT_PACKAGES

echo "==> Building Docker image: $IMAGE_NAME"
docker build \
  --build-arg "CLAWDBOT_DOCKER_APT_PACKAGES=${CLAWDBOT_DOCKER_APT_PACKAGES}" \
  -t "$IMAGE_NAME" \
  -f "$ROOT_DIR/Dockerfile" \
  "$ROOT_DIR"

echo ""
echo "==> Onboarding (interactive)"
echo "When prompted:"
echo "  - Gateway bind: lan"
echo "  - Gateway auth: token"
echo "  - Gateway token: $CLAWDBOT_GATEWAY_TOKEN"
echo "  - Tailscale exposure: Off"
echo "  - Install Gateway daemon: No"
echo ""
docker compose "${COMPOSE_ARGS[@]}" run --rm clawdbot-cli onboard --no-install-daemon

echo ""
echo "==> Channel setup (optional)"
echo ""
echo "TELEGRAM:"
echo "  1. Create a bot with @BotFather on Telegram"
echo "  2. Set TELEGRAM_BOT_TOKEN in .env file"
echo "  3. Or add via CLI:"
echo "     ${COMPOSE_HINT} run --rm clawdbot-cli channels add --channel telegram --token <token>"
echo ""
echo "SLACK:"
echo "  1. Create a Slack app at https://api.slack.com/apps"
echo "  2. Enable Socket Mode and generate App-Level Token"
echo "  3. Set SLACK_BOT_TOKEN and SLACK_APP_TOKEN in .env file"
echo "  4. See docs/channels/slack.md for detailed setup"
echo ""
echo "SIGNAL:"
echo "  1. Set SIGNAL_PHONE_NUMBER in .env file (e.g., +15551234567)"
echo "  2. After starting the gateway, register the number:"
echo "     docker exec -it clawdbot-gateway signal-cli -a +15551234567 register"
echo "  3. Complete captcha at https://signalcaptchas.org/registration/generate.html"
echo "  4. Register with captcha:"
echo "     docker exec -it clawdbot-gateway signal-cli -a +15551234567 register --captcha 'signalcaptcha://...'"
echo "  5. Verify with SMS code:"
echo "     docker exec -it clawdbot-gateway signal-cli -a +15551234567 verify <CODE>"
echo "  6. See docs/channels/signal-cli-registration.md for detailed guide"
echo ""
echo "WHATSAPP (QR):"
echo "  ${COMPOSE_HINT} run --rm clawdbot-cli channels login"
echo ""
echo "DISCORD:"
echo "  Set DISCORD_BOT_TOKEN in .env file"
echo "  Or: ${COMPOSE_HINT} run --rm clawdbot-cli channels add --channel discord --token <token>"
echo ""
echo "Docs: https://docs.clawd.bot/channels"

echo ""
echo "==> Starting gateway"
docker compose "${COMPOSE_ARGS[@]}" up -d clawdbot-gateway

echo ""
echo "==> Gateway started successfully!"
echo ""
echo "Configuration:"
echo "  Config dir:  $CLAWDBOT_CONFIG_DIR"
echo "  Workspace:   $CLAWDBOT_WORKSPACE_DIR"
echo "  Gateway URL: http://localhost:${CLAWDBOT_GATEWAY_PORT}"
echo "  Auth token:  $CLAWDBOT_GATEWAY_TOKEN"
echo ""
echo "Useful commands:"
echo "  View logs:        ${COMPOSE_HINT} logs -f clawdbot-gateway"
echo "  Check health:     ${COMPOSE_HINT} exec clawdbot-gateway node dist/index.js health --token \"$CLAWDBOT_GATEWAY_TOKEN\""
echo "  Stop gateway:     ${COMPOSE_HINT} down"
echo "  Restart gateway:  ${COMPOSE_HINT} restart clawdbot-gateway"
echo "  Shell access:     ${COMPOSE_HINT} exec clawdbot-gateway bash"
echo ""
echo "Signal registration (if using Signal):"
echo "  docker exec -it clawdbot-gateway signal-cli -a <phone> register"
echo ""
echo "Next steps:"
echo "  1. Configure your channels in .env (see .env.example)"
echo "  2. Restart the gateway: ${COMPOSE_HINT} restart clawdbot-gateway"
echo "  3. Check logs: ${COMPOSE_HINT} logs -f clawdbot-gateway"
echo "  4. Access the dashboard: http://localhost:${CLAWDBOT_GATEWAY_PORT}"
echo ""
