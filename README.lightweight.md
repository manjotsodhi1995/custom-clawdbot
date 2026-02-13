# Clawdbot Lightweight

A streamlined version of Clawdbot focused on Signal, Telegram, and Slack integration with remote agent capabilities.

## Features

- ✅ **Signal** - Full integration via signal-cli
- ✅ **Telegram** - Bot API with grammY
- ✅ **Slack** - Bolt framework integration
- ✅ **Remote Agent** - Blackbox agent integration via RPC
- ✅ **Gateway** - WebSocket control plane
- ✅ **Lightweight** - ~80% smaller than full Clawdbot

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your tokens

# 3. Deploy
./deploy.sh
```

## Requirements

- Node.js >= 22
- Linux/macOS (Windows via WSL2)
- At least one channel token (Telegram, Slack, or Signal)
- AI provider API key (Anthropic or OpenAI)

## Configuration

Minimal `~/.clawdbot/clawdbot.json`:

```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5"
  },
  "channels": {
    "telegram": {
      "botToken": "YOUR_TOKEN"
    }
  },
  "gateway": {
    "port": 18789
  }
}
```

## Environment Variables

```bash
# AI Provider (required)
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...

# Channels (at least one)
TELEGRAM_BOT_TOKEN=123456:ABC...
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SIGNAL_ACCOUNT=+1234567890
```

## Deployment Options

### Local (systemd)
```bash
./deploy.sh --service systemd
```

### Local (PM2)
```bash
./deploy.sh --service pm2
```

### Docker
```bash
docker-compose up -d
```

### Manual
```bash
npm run build
node dist/entry.js gateway run
```

## Usage

### Start Gateway
```bash
# Via deploy script
./deploy.sh

# Or directly
npm start
```

### Send Message
```bash
npx clawdbot message send --to @username --message "Hello"
```

### Agent Query
```bash
npx clawdbot agent --message "What's the weather?" --thinking low
```

### Check Status
```bash
./deploy.sh --status
# or
npx clawdbot channels status
```

## Management

### Restart
```bash
./deploy.sh --restart
```

### Stop
```bash
./deploy.sh --stop
```

### Logs
```bash
# Systemd
journalctl -u clawdbot-gateway -f

# PM2
pm2 logs clawdbot-gateway

# Docker
docker-compose logs -f
```

### Health Check
```bash
curl http://localhost:18789/health
```

## Architecture

```
┌──────────────────────────────────┐
│  Signal / Telegram / Slack       │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│         Gateway (WS)             │
│      Port 18789 (loopback)       │
└────────────┬─────────────────────┘
             │
             ├─ Message Router
             ├─ Session Manager
             ├─ Remote Agent (RPC)
             └─ Channel Handlers
```

## What's Removed

This lightweight version removes:
- WhatsApp, Discord, iMessage, Google Chat
- macOS/iOS/Android apps
- Web UI (can be re-enabled)
- Browser automation
- Canvas/A2UI
- Voice features
- Most skills
- Platform-specific features

See [CLEANUP.md](CLEANUP.md) for full details.

## Security

- Gateway binds to `127.0.0.1` by default
- DM pairing enabled for untrusted senders
- Environment variables for sensitive tokens
- Session isolation per channel/user

## Troubleshooting

### Port in use
```bash
lsof -i :18789
# Kill existing process or change port
GATEWAY_PORT=18790 ./deploy.sh
```

### Channel not connecting
```bash
# Check configuration
npx clawdbot config get channels.telegram

# Probe channel
npx clawdbot channels probe telegram
```

### Agent not responding
```bash
# Check logs
tail -f ~/.clawdbot/logs/gateway.log

# Test agent
npx clawdbot agent --message "test" --thinking low
```

### Dependencies
```bash
# Reinstall
rm -rf node_modules
npm install

# Rebuild
npm run build
```

## Development

```bash
# Install
npm install

# Build
npm run build

# Dev mode
npm run gateway:dev

# Tests
npm test
```

## Docker

### Build
```bash
docker build -f Dockerfile.lightweight -t clawdbot-lightweight .
```

### Run
```bash
docker run -d \
  --name clawdbot \
  -p 18789:18789 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN \
  -v clawdbot-data:/home/clawdbot/.clawdbot \
  clawdbot-lightweight
```

### Compose
```bash
# Start
docker-compose up -d

# Logs
docker-compose logs -f

# Stop
docker-compose down
```

## Updating

```bash
git pull
npm install
npm run build
./deploy.sh --restart
```

## Configuration Reference

### Gateway
```json
{
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789
  }
}
```

### Telegram
```json
{
  "channels": {
    "telegram": {
      "botToken": "123456:ABC...",
      "allowFrom": ["@username"],
      "groups": {
        "*": {
          "requireMention": true
        }
      }
    }
  }
}
```

### Slack
```json
{
  "channels": {
    "slack": {
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "allowFrom": ["U123ABC"]
    }
  }
}
```

### Signal
```json
{
  "channels": {
    "signal": {
      "account": "+1234567890",
      "allowFrom": ["+1234567890"]
    }
  }
}
```

### Agent
```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5",
    "workspace": "~/clawd"
  }
}
```

## Support

- Original Clawdbot: https://github.com/clawdbot/clawdbot
- Deployment issues: Check logs and configuration
- Channel issues: Use `npx clawdbot channels probe <channel>`

## License

MIT (same as original Clawdbot)

## Credits

Based on [Clawdbot](https://github.com/clawdbot/clawdbot) by Peter Steinberger and contributors.

This lightweight version focuses on core messaging channels for server deployments.
