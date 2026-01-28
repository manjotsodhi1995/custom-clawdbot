# ClawdBot Docker Setup
# Multi-stage build for WhatsApp gateway

FROM node:22-bookworm AS builder

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

WORKDIR /app

# Copy package files first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files including vendor and apps/shared needed for build
COPY src ./src
COPY ui ./ui
COPY vendor ./vendor
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

# Install pnpm and jq for config manipulation
RUN apt-get update && apt-get install -y --no-install-recommends jq && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@10.23.0 --activate

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

# Create .clawdbot directory for config
RUN mkdir -p /home/clawdbot/.clawdbot && \
    chown -R clawdbot:clawdbot /home/clawdbot/.clawdbot && \
    chown -R clawdbot:clawdbot /app

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
    'if [ "$1" = "onboard" ]; then' \
    '    echo "Starting onboard wizard..."' \
    '    node dist/entry.js onboard' \
    '    echo ""' \
    '    echo "Applying Docker network settings..."' \
    '    apply_docker_bind' \
    '    echo "Done! Start the gateway with:"' \
    '    echo "  docker run -d -p 18789:18789 -v clawdbot-config:/home/clawdbot/.clawdbot clawdbot"' \
    '    exit 0' \
    'fi' \
    '' \
    'if [ "$1" = "gateway" ]; then' \
    '    shift' \
    '    echo "Starting ClawdBot gateway..."' \
    '    exec node dist/entry.js gateway "$@"' \
    'fi' \
    '' \
    'exec node dist/entry.js "$@"' \
    > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Switch to non-root user
USER clawdbot

# Set environment variables
ENV NODE_ENV=production
ENV HOME=/home/clawdbot
ENV CLAWDBOT_CONFIG_DIR=/home/clawdbot/.clawdbot

# Expose gateway port
EXPOSE 18789

# Default command - runs gateway
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["gateway", "--port", "18789", "--verbose"]
