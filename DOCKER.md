# ClawdBot Docker Setup

Run ClawdBot in Docker with WhatsApp integration.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, recommended)

## Quick Start

### 1. Build the Docker Image

```bash
docker build -t clawdbot .
```

Note: Run this from the `clawdbot-fork` directory.

**Fresh build (no cache):**

```bash
docker build --no-cache -t clawdbot .
```

**Reset everything (fresh start):**

```bash
# Remove existing container, image, and config volume
docker rm -f clawdbot-gateway 2>/dev/null
docker rmi clawdbot 2>/dev/null
docker volume rm clawdbot-config 2>/dev/null

# Build fresh
docker build --no-cache -t clawdbot .
```

### 2. Run the Onboard Wizard (First Time Setup)

```bash
docker run -it --rm \
  -v clawdbot-config:/home/clawdbot/.clawdbot \
  clawdbot onboard
```

The wizard will guide you through:
- Model provider setup (API keys, endpoints)
- WhatsApp linking (scan QR code)
- DM policy configuration (select "Open" for public access)

After onboarding, Docker network settings are automatically applied.

### 3. Start the Gateway

```bash
docker run -d \
  --name clawdbot-gateway \
  -p 18789:18789 \
  -v clawdbot-config:/home/clawdbot/.clawdbot \
  clawdbot
```

Gateway is accessible at `http://localhost:18789`.

## Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  clawdbot:
    build: .
    container_name: clawdbot-gateway
    ports:
      - "18789:18789"
    volumes:
      - clawdbot-config:/home/clawdbot/.clawdbot
    restart: unless-stopped

volumes:
  clawdbot-config:
```

Commands:

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Run onboard (first time)
docker-compose run --rm clawdbot onboard
```

## Configuration

### Docker Network Settings

After onboarding, the entrypoint automatically sets `gateway.bind: "lan"` so the gateway is accessible from outside the container.

### Custom Configuration

Mount a custom config file:

```bash
docker run -d \
  --name clawdbot-gateway \
  -p 18789:18789 \
  -v /path/to/clawdbot.json:/home/clawdbot/.clawdbot/clawdbot.json \
  -v clawdbot-data:/home/clawdbot/.clawdbot/data \
  clawdbot
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAWDBOT_CONFIG_DIR` | Config directory path | `/home/clawdbot/.clawdbot` |
| `NODE_ENV` | Node.js environment | `production` |

## Persistent Data

The config volume stores:
- `clawdbot.json` - Main configuration
- `sessions/` - WhatsApp session data
- `data/` - Application data

### Backup & Restore

```bash
# Backup
docker run --rm -v clawdbot-config:/data -v $(pwd):/backup alpine \
  tar czf /backup/clawdbot-backup.tar.gz -C /data .

# Restore
docker run --rm -v clawdbot-config:/data -v $(pwd):/backup alpine \
  tar xzf /backup/clawdbot-backup.tar.gz -C /data
```

## Troubleshooting

### Gateway not accessible

Ensure `gateway.bind` is set to `"lan"`. This is done automatically after onboarding, but you can verify:

```bash
docker run --rm -v clawdbot-config:/data alpine cat /data/clawdbot.json | grep bind
```

### WhatsApp QR code not showing

Run in interactive mode:

```bash
docker run -it -v clawdbot-config:/home/clawdbot/.clawdbot clawdbot onboard
```

### Permission errors

The container runs as user `clawdbot` (uid 1001). For host-mounted directories:

```bash
sudo chown -R 1001:1001 /path/to/host/config
```

### View logs

```bash
docker logs -f clawdbot-gateway
```

## Multi-Architecture Builds

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t clawdbot:latest .
```

## Security Notes

- Container runs as non-root user
- Sensitive data stored in config volume
- Use Docker secrets for API keys in production
- Consider a reverse proxy with TLS for production deployments
