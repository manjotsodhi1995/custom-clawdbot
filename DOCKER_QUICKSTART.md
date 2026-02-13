# ClawdBot Docker Quick Start

Get ClawdBot running in Docker with Telegram, Signal, and Slack in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Tokens for your channels (see below)

## 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/clawdbot/clawdbot.git
cd clawdbot

# Copy environment template
cp .env.example .env

# Edit .env with your tokens
nano .env
```

## 2. Get Your Tokens

### Telegram
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Copy the token to `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

### Slack
1. Create app at https://api.slack.com/apps
2. Enable Socket Mode → Generate App-Level Token
3. Install app → Copy Bot Token
4. Add to `.env`:
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_APP_TOKEN=xapp-your-app-token
   ```

### Signal
1. Add phone number to `.env`:
   ```bash
   SIGNAL_PHONE_NUMBER=+15551234567
   ```
2. Register after starting (see step 4)

### AI Models
Add at least one:
```bash
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

## 3. Start ClawdBot

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f
```

## 4. Register Signal (if using)

```bash
# Run the helper script
./scripts/docker/signal-register.sh +15551234567

# Or manually:
docker exec -it clawdbot-gateway signal-cli -a +15551234567 register --captcha 'signalcaptcha://...'
docker exec -it clawdbot-gateway signal-cli -a +15551234567 verify 123456
```

## 5. Access the Gateway

Open http://localhost:18789 in your browser.

## Common Commands

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Shell access
docker-compose exec clawdbot bash

# Check health
docker-compose exec clawdbot /docker-entrypoint.sh health
```

## Troubleshooting

### Gateway not accessible
```bash
# Check if running
docker-compose ps

# Check logs
docker-compose logs clawdbot
```

### Telegram not working
```bash
# Test token
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
```

### Signal not working
```bash
# Check registration
docker exec clawdbot-gateway signal-cli -a +15551234567 receive --timeout 1
```

### Slack not connecting
- Verify Socket Mode is enabled in Slack app settings
- Check both tokens are set in `.env`

## Next Steps

- Configure channels in `./clawdbot-data/clawdbot.json`
- Read full documentation: [DOCKER.md](DOCKER.md)
- Join Discord: https://discord.gg/clawd

## File Locations

- **Config:** `./clawdbot-data/clawdbot.json`
- **Logs:** `docker-compose logs -f`
- **Signal data:** `./signal-cli-data/`
- **Telegram data:** `./telegram-data/`

## Security Notes

- Gateway is bound to localhost (127.0.0.1) by default
- All channels use pairing mode for DM security
- Keep your `.env` file secure (never commit it)
- Use strong tokens for production

## Getting Help

- Full docs: [DOCKER.md](DOCKER.md)
- Summary: [DOCKERIZATION_SUMMARY.md](DOCKERIZATION_SUMMARY.md)
- Discord: https://discord.gg/clawd
- Issues: https://github.com/clawdbot/clawdbot/issues

---

**That's it!** Your ClawdBot is now running with Telegram, Signal, and Slack support. 🎉
