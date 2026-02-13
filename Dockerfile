# ClawdBot Docker Setup
# Multi-stage build with support for Telegram, Signal, and Slack

FROM node:22-bookworm AS builder

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

WORKDIR /app

# Copy package files first for layer caching
COPY package.json pnpm-workspace.yaml ./
COPY .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

# Copy lock file if it exists, otherwise pnpm will generate one
COPY pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source files including apps/shared needed for build
COPY src ./src
COPY ui ./ui
COPY apps/shared ./apps/shared
COPY assets ./assets
COPY skills ./skills
COPY extensions ./extensions
COPY docs ./docs
COPY tsconfig.json vitest.config.ts ./

# Build the project
RUN pnpm ui:build && pnpm build

# Production stage
FROM node:22-bookworm-slim AS production

# Install system dependencies including Java for signal-cli
RUN apt-get update && apt-get install -y --no-install-recommends \
    jq \
    curl \
    wget \
    ca-certificates \
    gnupg \
    openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@10.23.0 --activate

# Install signal-cli
ARG SIGNAL_CLI_VERSION=0.13.9
RUN wget -q https://github.com/AsamK/signal-cli/releases/download/v${SIGNAL_CLI_VERSION}/signal-cli-${SIGNAL_CLI_VERSION}-Linux.tar.gz \
    && tar xf signal-cli-${SIGNAL_CLI_VERSION}-Linux.tar.gz -C /opt \
    && ln -sf /opt/signal-cli-${SIGNAL_CLI_VERSION}/bin/signal-cli /usr/local/bin/signal-cli \
    && rm signal-cli-${SIGNAL_CLI_VERSION}-Linux.tar.gz

# Create non-root user for security
RUN groupadd --gid 1001 clawdbot && \
    useradd --uid 1001 --gid clawdbot --shell /bin/bash --create-home clawdbot

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ui ./ui
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/skills ./skills
COPY --from=builder /app/extensions ./extensions
COPY --from=builder /app/docs ./docs

# Create necessary directories for config and signal-cli
RUN mkdir -p /home/clawdbot/.clawdbot \
    /home/clawdbot/.clawdbot/workspace \
    /home/clawdbot/.local/share/signal-cli \
    /home/clawdbot/.clawdbot/telegram \
    && chown -R clawdbot:clawdbot /home/clawdbot/.clawdbot \
    && chown -R clawdbot:clawdbot /home/clawdbot/.local \
    && chown -R clawdbot:clawdbot /app

# Create entrypoint script inline to avoid Windows line ending issues
RUN printf '%s\n' \
    '#!/bin/bash' \
    'set -e' \
    '' \
    'CONFIG_DIR="${CLAWDBOT_CONFIG_DIR:-$HOME/.clawdbot}"' \
    'CONFIG_FILE="$CONFIG_DIR/clawdbot.json"' \
    '' \
    '# Set gateway.bind to lan for Docker accessibility' \
    'apply_docker_bind() {' \
    '    if [ -f "$CONFIG_FILE" ]; then' \
    '        jq ".gateway.bind = \"lan\"" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"' \
    '    fi' \
    '}' \
    '' \
    '# Initialize signal-cli if configured' \
    'init_signal() {' \
    '    if [ -n "$SIGNAL_PHONE_NUMBER" ]; then' \
    '        echo "Signal phone number detected: $SIGNAL_PHONE_NUMBER"' \
    '        if [ ! -d "$HOME/.local/share/signal-cli/data/$SIGNAL_PHONE_NUMBER" ]; then' \
    '            echo "Signal account not registered. Please register manually:"' \
    '            echo "  docker exec -it <container> signal-cli -a $SIGNAL_PHONE_NUMBER register"' \
    '        else' \
    '            echo "Signal account found for $SIGNAL_PHONE_NUMBER"' \
    '        fi' \
    '    fi' \
    '}' \
    '' \
    '# Health check function' \
    'health_check() {' \
    '    if [ -f "$CONFIG_DIR/gateway.pid" ]; then' \
    '        PID=$(cat "$CONFIG_DIR/gateway.pid")' \
    '        if kill -0 "$PID" 2>/dev/null; then' \
    '            exit 0' \
    '        fi' \
    '    fi' \
    '    exit 1' \
    '}' \
    '' \
    'if [ "$1" = "health" ]; then' \
    '    health_check' \
    'fi' \
    '' \
    'if [ "$1" = "onboard" ]; then' \
    '    echo "Starting onboard wizard..."' \
    '    node dist/entry.js onboard' \
    '    echo ""' \
    '    echo "Applying Docker network settings..."' \
    '    apply_docker_bind' \
    '    echo "Done! Start the gateway with:"' \
    '    echo "  docker-compose up -d"' \
    '    exit 0' \
    'fi' \
    '' \
    'if [ "$1" = "gateway" ]; then' \
    '    shift' \
    '    echo "Starting ClawdBot gateway..."' \
    '    init_signal' \
    '    exec node dist/entry.js gateway "$@"' \
    'fi' \
    '' \
    'exec node dist/entry.js "$@"' \
    > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Switch to non-root user
USER clawdbot

# Set environment variables
ENV NODE_ENV=production \
    HOME=/home/clawdbot \
    CLAWDBOT_CONFIG_DIR=/home/clawdbot/.clawdbot \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    PATH=/usr/local/bin:$PATH

# Expose gateway port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["/docker-entrypoint.sh", "health"]

# Default command - runs gateway
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["gateway", "--port", "18789", "--verbose"]
