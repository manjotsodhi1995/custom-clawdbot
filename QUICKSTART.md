# Quick Start Guide

Get Clawdbot Lightweight running in 5 minutes.

## Prerequisites

- Node.js 22+
- Linux or macOS (Windows via WSL2)
- One of: Telegram bot token, Slack tokens, or Signal account
- AI provider API key (Anthropic or OpenAI)

## 1. Get Tokens

### Telegram Bot
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow prompts
3. Save the bot token (format: `123456:ABC-DEF...`)

### Slack Bot
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create new app → From scratch
3. Enable Socket Mode
4. Add Bot Token Scopes: `chat:write`, `channels:history`, `groups:history`, `im:history`, `mpim:history`
5. Install to workspace
6. Save Bot Token (`xoxb-...`) and App Token (`xapp-...`)

### Signal
1. Install signal-cli: `brew install signal-cli` (macOS) or from [signal-cli releases](https://github.com/AsamK/signal-cli/releases)
2. Register phone number: `signal-cli -a +1234567890 register`
3. Verify: `signal-cli -a +1234567890 verify CODE`

### AI Provider
- **Anthropic**: Get API key from [console.anthropic.com](https://console.anthropic.com)
- **OpenAI**: Get API key from [platform.openai.com](https://platform.openai.com)

## 2. Install

```bash
# Clone repository
git clone <your-repo-url>
cd clawdbot-lightweight

# Install dependencies
npm install

# Build
npm run build
```

## 3. Configure

```bash
# Copy environment template
cp .env.example .env

# Edit with your tokens
nano .env
```

Add your tokens:
```bash
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=123456:ABC...
```

## 4. Deploy

```bash
# Quick deploy (auto-detects systemd/pm2)
./deploy.sh

# Or specify service manager
./deploy.sh --service systemd
./deploy.sh --service pm2

# Or run manually (foreground)
./deploy.sh --service manual
```

## 5. Test

```bash
# Check health
curl http://localhost:18789/health

# Check status
./deploy.sh --status

# Send test message (Telegram)
npx clawdbot agent --message "Hello, are you working?" --thinking low
```

## 6. Use

### Via Telegram
1. Find your bot on Telegram (search for username you created)
2. Send `/start`
3. Send any message to chat with the agent

### Via Slack
1. Invite bot to channel: `/invite @YourBot`
2. Mention bot: `@YourBot what's the weather?`
3. Or DM the bot directly

### Via Signal
1. Send message to the Signal number you configured
2. Bot will respond to messages from allowed numbers

## Common Issues

### Port already in use
```bash
# Change port
GATEWAY_PORT=18790 ./deploy.sh
```

### Bot not responding
```bash
# Check logs
tail -f ~/.clawdbot/logs/gateway.log

# Check channel status
npx clawdbot channels status

# Probe specific channel
npx clawdbot channels probe telegram
```

### Permission denied
```bash
# Check file permissions
ls -la ~/.clawdbot/

# Fix if needed
chmod 700 ~/.clawdbot
chmod 600 ~/.clawdbot/clawdbot.json
```

### Dependencies missing
```bash
# Reinstall
rm -rf node_modules
npm install
npm run build
```

## Next Steps

- **Configure channels**: Edit `~/.clawdbot/clawdbot.json`
- **Set up allowlists**: Add trusted users to channel configs
- **Enable DM pairing**: For untrusted channels
- **Monitor logs**: `tail -f ~/.clawdbot/logs/gateway.log`
- **Update**: `git pull && npm install && npm run build && ./deploy.sh --restart`

## Configuration Examples

### Minimal (Telegram only)
```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5"
  },
  "channels": {
    "telegram": {
      "botToken": "123456:ABC..."
    }
  }
}
```

### With Allowlist
```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5"
  },
  "channels": {
    "telegram": {
      "botToken": "123456:ABC...",
      "allowFrom": ["@yourusername", "@trusteduser"]
    }
  }
}
```

### Multiple Channels
```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5"
  },
  "channels": {
    "telegram": {
      "botToken": "123456:ABC...",
      "allowFrom": ["@yourusername"]
    },
    "slack": {
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "allowFrom": ["U123ABC"]
    },
    "signal": {
      "account": "+1234567890",
      "allowFrom": ["+1234567890"]
    }
  }
}
```

## Docker Quick Start

```bash
# Copy environment
cp .env.example .env
# Edit .env with your tokens

# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Check health
curl http://localhost:18789/health
```

## Management Commands

```bash
# Status
./deploy.sh --status

# Restart
./deploy.sh --restart

# Stop
./deploy.sh --stop

# Logs (systemd)
journalctl -u clawdbot-gateway -f

# Logs (PM2)
pm2 logs clawdbot-gateway

# Logs (Docker)
docker-compose logs -f
```

## Getting Help

1. Check logs first: `tail -f ~/.clawdbot/logs/gateway.log`
2. Verify configuration: `cat ~/.clawdbot/clawdbot.json`
3. Test channels: `npx clawdbot channels status --probe`
4. Review [DEPLOYMENT.md](DEPLOYMENT.md) for detailed docs

## Security Checklist

- [ ] Gateway binds to loopback (127.0.0.1)
- [ ] Tokens stored in environment variables or secure config
- [ ] Allowlists configured for channels
- [ ] DM pairing enabled for untrusted channels
- [ ] Config file permissions: `chmod 600 ~/.clawdbot/clawdbot.json`
- [ ] Regular updates: `git pull && npm install && npm run build`

## Success!

Your lightweight Clawdbot is now running. Send a message to test it out!

For advanced configuration, see [DEPLOYMENT.md](DEPLOYMENT.md).
