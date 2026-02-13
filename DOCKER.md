# ClawdBot Docker Setup

Run ClawdBot in Docker with support for Telegram, Signal, Slack, WhatsApp, Discord, and more.

## Prerequisites

- Docker installed on your system
- Docker Compose (recommended)
- For Signal: A phone number that can receive SMS

## Quick Start

The easiest way to get started is using the automated setup script:

```bash
./docker-setup.sh
```

This script will:
1. Build the Docker image
2. Run the onboarding wizard
3. Start the gateway
4. Display setup instructions for all channels

## Manual Setup

### 1. Configure Environment Variables

Copy the example environment file and configure your channels:

```bash
cp .env.example .env
```

Edit `.env` and add your tokens:

```bash
# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Signal
SIGNAL_PHONE_NUMBER=+15551234567

# AI Models
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

### 2. Build the Docker Image

```bash
docker-compose build
```

Or build manually:

```bash
docker build -t clawdbot:latest .
```

**Fresh build (no cache):**

```bash
docker-compose build --no-cache
```

### 3. Run the Onboard Wizard (First Time Setup)

```bash
docker-compose run --rm clawdbot onboard
```

The wizard will guide you through:
- Model provider setup (API keys, endpoints)
- Gateway configuration
- Channel setup options

### 4. Start the Gateway

```bash
docker-compose up -d
```

Gateway is accessible at `http://localhost:18789`.

## Channel Configuration

### Telegram Setup

1. **Create a bot with @BotFather:**
   - Open Telegram and chat with [@BotFather](https://t.me/BotFather)
   - Send `/newbot` and follow the prompts
   - Copy the bot token

2. **Configure in .env:**
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

3. **Configure access control in clawdbot.json:**
   ```json
   {
     "channels": {
       "telegram": {
         "enabled": true,
         "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
         "dmPolicy": "pairing",
         "allowFrom": ["123456789"],
         "groups": {
           "*": {
             "requireMention": true
           }
         }
       }
     }
   }
   ```

4. **Restart the gateway:**
   ```bash
   docker-compose restart
   ```

**Documentation:** [docs/channels/telegram.md](docs/channels/telegram.md)

### Signal Setup

Signal requires additional setup steps for registration.

#### Option 1: Using the Helper Script (Recommended)

```bash
./scripts/docker/signal-register.sh +15551234567
```

This interactive script will guide you through:
1. Getting a captcha from Signal
2. Registering your number
3. Verifying with SMS code

#### Option 2: Manual Registration

1. **Set phone number in .env:**
   ```bash
   SIGNAL_PHONE_NUMBER=+15551234567
   ```

2. **Start the container:**
   ```bash
   docker-compose up -d
   ```

3. **Get captcha:**
   - Open https://signalcaptchas.org/registration/generate.html
   - Complete the captcha
   - Copy the `signalcaptcha://` URL

4. **Register with captcha:**
   ```bash
   docker exec -it clawdbot-gateway signal-cli -a +15551234567 register --captcha 'signalcaptcha://...'
   ```

5. **Verify with SMS code:**
   ```bash
   docker exec -it clawdbot-gateway signal-cli -a +15551234567 verify 123456
   ```

6. **Configure in clawdbot.json:**
   ```json
   {
     "channels": {
       "signal": {
         "enabled": true,
         "account": "+15551234567",
         "cliPath": "signal-cli",
         "dmPolicy": "pairing",
         "allowFrom": ["+15557654321"]
       }
     }
   }
   ```

7. **Restart the gateway:**
   ```bash
   docker-compose restart
   ```

**Documentation:** [docs/channels/signal.md](docs/channels/signal.md) | [docs/channels/signal-cli-registration.md](docs/channels/signal-cli-registration.md)

### Slack Setup

1. **Create a Slack app:**
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Name your app and select your workspace

2. **Enable Socket Mode:**
   - Go to "Socket Mode" in the sidebar
   - Toggle "Enable Socket Mode"
   - Generate an App-Level Token with `connections:write` scope
   - Copy the token (starts with `xapp-`)

3. **Add Bot Token Scopes:**
   - Go to "OAuth & Permissions"
   - Add these Bot Token Scopes:
     - `chat:write`
     - `im:write`
     - `channels:history`
     - `groups:history`
     - `im:history`
     - `mpim:history`
     - `channels:read`
     - `groups:read`
     - `im:read`
     - `mpim:read`
     - `users:read`
     - `reactions:read`
     - `reactions:write`
     - `files:write`

4. **Install the app:**
   - Click "Install to Workspace"
   - Copy the Bot User OAuth Token (starts with `xoxb-`)

5. **Configure in .env:**
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_APP_TOKEN=xapp-your-app-token
   ```

6. **Configure in clawdbot.json:**
   ```json
   {
     "channels": {
       "slack": {
         "enabled": true,
         "botToken": "xoxb-...",
         "appToken": "xapp-...",
         "dm": {
           "policy": "pairing",
           "allowFrom": ["U123456789"]
         }
       }
     }
   }
   ```

7. **Restart the gateway:**
   ```bash
   docker-compose restart
   ```

**Documentation:** [docs/channels/slack.md](docs/channels/slack.md)

### WhatsApp Setup

WhatsApp uses QR code authentication:

```bash
docker-compose run --rm clawdbot channels login
```

Scan the QR code with your WhatsApp mobile app.

### Discord Setup

1. **Create a Discord bot:**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to "Bot" section and create a bot
   - Copy the bot token

2. **Configure in .env:**
   ```bash
   DISCORD_BOT_TOKEN=your-discord-bot-token
   ```

3. **Restart the gateway:**
   ```bash
   docker-compose restart
   ```

## Docker Compose Configuration

The provided `docker-compose.yml` includes:

- **Environment variables** for all channels
- **Volume mounts** for persistent data
- **Health checks** for monitoring
- **Resource limits** (configurable)
- **Logging configuration**

### Using Docker Compose

```bash
# Start the gateway
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the gateway
docker-compose down

# Restart the gateway
docker-compose restart

# View status
docker-compose ps

# Execute commands in the container
docker-compose exec clawdbot bash
```

## Data Persistence

### Volume Mounts

The default configuration uses bind mounts:

- `./clawdbot-data` → Main config directory
- `./clawdbot-data/workspace` → Agent workspace
- `./signal-cli-data` → Signal account data
- `./telegram-data` → Telegram session data

### Using Named Volumes

For production, consider using named volumes instead of bind mounts. Edit `docker-compose.yml`:

```yaml
volumes:
  - clawdbot-config:/home/clawdbot/.clawdbot
  - clawdbot-workspace:/home/clawdbot/.clawdbot/workspace
  - signal-cli-data:/home/clawdbot/.local/share/signal-cli
```

### Backup & Restore

**Backup:**
```bash
# Backup all data
docker run --rm \
  -v clawdbot-config:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/clawdbot-backup-$(date +%Y%m%d).tar.gz -C /data .

# Backup Signal data
docker run --rm \
  -v signal-cli-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/signal-backup-$(date +%Y%m%d).tar.gz -C /data .
```

**Restore:**
```bash
# Restore config
docker run --rm \
  -v clawdbot-config:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/clawdbot-backup-20240101.tar.gz -C /data

# Restore Signal data
docker run --rm \
  -v signal-cli-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/signal-backup-20240101.tar.gz -C /data
```

## Configuration Files

### Main Configuration (clawdbot.json)

Located at `./clawdbot-data/clawdbot.json` (or in the volume).

Example with all three channels:

```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5"
  },
  "gateway": {
    "bind": "lan",
    "port": 18789,
    "auth": {
      "mode": "token"
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123456789:ABC...",
      "dmPolicy": "pairing",
      "allowFrom": ["123456789"],
      "groups": {
        "*": {
          "requireMention": true
        }
      }
    },
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "cliPath": "signal-cli",
      "dmPolicy": "pairing",
      "allowFrom": ["+15557654321"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["+15557654321"]
    },
    "slack": {
      "enabled": true,
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "dm": {
        "policy": "pairing",
        "allowFrom": ["U123456789"]
      },
      "groupPolicy": "allowlist",
      "channels": {
        "C123456789": {}
      }
    }
  }
}
```

## Useful Commands

### Container Management

```bash
# View logs
docker-compose logs -f clawdbot

# Follow logs for specific service
docker-compose logs -f clawdbot

# Execute shell in container
docker-compose exec clawdbot bash

# Restart container
docker-compose restart clawdbot

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes
docker-compose down -v
```

### Signal Commands

```bash
# Check Signal registration status
docker exec clawdbot-gateway signal-cli -a +15551234567 receive --timeout 1

# List Signal accounts
docker exec clawdbot-gateway signal-cli listAccounts

# Send test message
docker exec clawdbot-gateway signal-cli -a +15551234567 send -m "Test" +15557654321

# Update Signal profile
docker exec clawdbot-gateway signal-cli -a +15551234567 updateProfile --name "ClawdBot"
```

### Gateway Commands

```bash
# Check gateway health
docker-compose exec clawdbot node dist/index.js health

# View gateway status
docker-compose exec clawdbot node dist/index.js status

# List channels
docker-compose exec clawdbot node dist/index.js channels list

# View pairing codes
docker-compose exec clawdbot node dist/index.js pairing list
```

## Troubleshooting

### Gateway not accessible

1. **Check if container is running:**
   ```bash
   docker-compose ps
   ```

2. **Check logs:**
   ```bash
   docker-compose logs -f clawdbot
   ```

3. **Verify gateway.bind is set to "lan":**
   ```bash
   docker-compose exec clawdbot cat /home/clawdbot/.clawdbot/clawdbot.json | grep bind
   ```

### Signal not working

1. **Check if signal-cli is installed:**
   ```bash
   docker-compose exec clawdbot signal-cli --version
   ```

2. **Check if number is registered:**
   ```bash
   docker exec clawdbot-gateway signal-cli -a +15551234567 receive --timeout 1
   ```

3. **View Signal logs:**
   ```bash
   docker-compose logs -f clawdbot | grep -i signal
   ```

4. **Common issues:**
   - **Not registered:** Run the registration process again
   - **Rate limited:** Wait 24-48 hours before trying again
   - **Wrong phone format:** Use E.164 format (+15551234567)

### Telegram not responding

1. **Check bot token:**
   ```bash
   docker-compose exec clawdbot printenv TELEGRAM_BOT_TOKEN
   ```

2. **Test bot token:**
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
   ```

3. **Check if bot is started:**
   ```bash
   docker-compose logs -f clawdbot | grep -i telegram
   ```

### Slack not connecting

1. **Check tokens:**
   ```bash
   docker-compose exec clawdbot printenv | grep SLACK
   ```

2. **Verify Socket Mode is enabled** in your Slack app settings

3. **Check logs:**
   ```bash
   docker-compose logs -f clawdbot | grep -i slack
   ```

### Permission errors

The container runs as user `clawdbot` (uid 1001). For host-mounted directories:

```bash
sudo chown -R 1001:1001 ./clawdbot-data
sudo chown -R 1001:1001 ./signal-cli-data
sudo chown -R 1001:1001 ./telegram-data
```

### Container won't start

1. **Check Docker logs:**
   ```bash
   docker-compose logs clawdbot
   ```

2. **Verify .env file exists:**
   ```bash
   ls -la .env
   ```

3. **Check for port conflicts:**
   ```bash
   lsof -i :18789
   ```

4. **Rebuild the image:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Health check failing

1. **Check health status:**
   ```bash
   docker inspect clawdbot-gateway | grep -A 10 Health
   ```

2. **Manual health check:**
   ```bash
   docker-compose exec clawdbot /docker-entrypoint.sh health
   ```

## Advanced Configuration

### Resource Limits

Edit `docker-compose.yml` to adjust resource limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '1'
      memory: 1G
```

### Custom Signal-CLI Version

Build with a different signal-cli version:

```bash
docker-compose build --build-arg SIGNAL_CLI_VERSION=0.13.8
```

Or set in `.env`:

```bash
SIGNAL_CLI_VERSION=0.13.8
```

### Multiple Instances

Run multiple instances with different configs:

```bash
# Instance 1
COMPOSE_PROJECT_NAME=clawdbot1 docker-compose up -d

# Instance 2
COMPOSE_PROJECT_NAME=clawdbot2 docker-compose -f docker-compose.yml up -d
```

### Using Docker Secrets

For production deployments, use Docker secrets:

```yaml
services:
  clawdbot:
    secrets:
      - telegram_token
      - slack_bot_token
      - slack_app_token
      - anthropic_key

secrets:
  telegram_token:
    file: ./secrets/telegram_token.txt
  slack_bot_token:
    file: ./secrets/slack_bot_token.txt
  slack_app_token:
    file: ./secrets/slack_app_token.txt
  anthropic_key:
    file: ./secrets/anthropic_key.txt
```

## Multi-Architecture Builds

Build for multiple architectures:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t clawdbot:latest .
```

## Production Deployment

### Security Checklist

- [ ] Use Docker secrets for sensitive data
- [ ] Set up a reverse proxy with TLS (nginx, Traefik)
- [ ] Use named volumes instead of bind mounts
- [ ] Configure proper firewall rules
- [ ] Enable Docker content trust
- [ ] Regular backups of volumes
- [ ] Monitor container health
- [ ] Use strong gateway authentication token
- [ ] Restrict gateway bind to localhost if using reverse proxy
- [ ] Keep Docker and images updated

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name clawdbot.example.com;

    ssl_certificate /etc/ssl/certs/clawdbot.crt;
    ssl_certificate_key /etc/ssl/private/clawdbot.key;

    location / {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Monitoring

Use Docker health checks and monitoring tools:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' clawdbot-gateway

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' clawdbot-gateway
```

## Additional Resources

- [Main Documentation](https://docs.clawd.bot)
- [Telegram Channel Setup](docs/channels/telegram.md)
- [Signal Channel Setup](docs/channels/signal.md)
- [Signal Registration Guide](docs/channels/signal-cli-registration.md)
- [Slack Channel Setup](docs/channels/slack.md)
- [Configuration Reference](https://docs.clawd.bot/gateway/configuration)
- [Security Guide](https://docs.clawd.bot/gateway/security)

## Getting Help

- Check the [troubleshooting section](#troubleshooting) above
- Review logs: `docker-compose logs -f`
- Join the [Discord community](https://discord.gg/clawd)
- Open an issue on [GitHub](https://github.com/clawdbot/clawdbot/issues)
