# Lightweight Deployment Guide

This is a streamlined version of Clawdbot focused on Signal, Telegram, and Slack integration with remote agent capabilities.

## Quick Deploy

```bash
# 1. Clone and install
git clone <your-repo>
cd <repo-name>
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your tokens

# 3. Deploy
./deploy.sh
```

## Deployment Script

The `deploy.sh` script handles:
- Environment validation
- Configuration setup
- Gateway installation
- Service management (systemd/pm2)
- Health checks

## Configuration

Minimal required configuration in `~/.clawdbot/clawdbot.json`:

```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5"
  },
  "channels": {
    "telegram": {
      "botToken": "YOUR_TELEGRAM_BOT_TOKEN"
    },
    "slack": {
      "botToken": "YOUR_SLACK_BOT_TOKEN",
      "appToken": "YOUR_SLACK_APP_TOKEN"
    },
    "signal": {
      "account": "+1234567890"
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789
  }
}
```

## Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `SLACK_BOT_TOKEN` - Slack bot token
- `SLACK_APP_TOKEN` - Slack app token
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - AI provider key

Optional:
- `SIGNAL_ACCOUNT` - Signal phone number
- `GATEWAY_PORT` - Gateway port (default: 18789)

## Service Management

### Using systemd (Linux)
```bash
./deploy.sh --service systemd
```

### Using PM2
```bash
./deploy.sh --service pm2
```

### Manual
```bash
npm start
```

## Health Check

```bash
curl http://localhost:18789/health
```

## Logs

```bash
# Systemd
journalctl -u clawdbot-gateway -f

# PM2
pm2 logs clawdbot-gateway

# Manual
tail -f ~/.clawdbot/logs/gateway.log
```

## Updating

```bash
git pull
npm install
./deploy.sh --restart
```

## Architecture

```
Signal/Telegram/Slack
        │
        ▼
   ┌─────────┐
   │ Gateway │ ← WebSocket (port 18789)
   └─────────┘
        │
        ├─ Remote Agent (RPC)
        ├─ Message Router
        └─ Channel Handlers
```

## Removed Features

This lightweight version removes:
- WhatsApp integration
- Discord integration
- iMessage integration
- macOS/iOS/Android apps
- Browser automation
- Canvas/A2UI
- Voice features
- Most skills
- Web UI (optional: can be re-enabled)

## Core Features Retained

- ✅ Signal, Telegram, Slack channels
- ✅ Remote agent integration
- ✅ Message routing
- ✅ Session management
- ✅ Gateway WebSocket API
- ✅ Configuration management
- ✅ Health monitoring

## Troubleshooting

### Gateway won't start
```bash
# Check port availability
lsof -i :18789

# Check logs
tail -f ~/.clawdbot/logs/gateway.log
```

### Channel not connecting
```bash
# Test configuration
npm run clawdbot channels status

# Probe specific channel
npm run clawdbot channels probe telegram
```

### Agent not responding
```bash
# Check agent status
npm run clawdbot agent --message "test" --thinking low
```

## Security

- Gateway binds to loopback by default (127.0.0.1)
- Use environment variables for sensitive tokens
- Enable DM pairing for untrusted channels
- Review `~/.clawdbot/clawdbot.json` permissions

## Support

For issues specific to this deployment:
- Check logs first
- Review configuration
- Test individual components
- Consult original Clawdbot docs for advanced features
