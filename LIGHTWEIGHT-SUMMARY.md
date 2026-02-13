# Clawdbot Lightweight - Summary

This document provides a complete overview of the lightweight Clawdbot deployment optimized for Signal, Telegram, and Slack.

## Overview

**Clawdbot Lightweight** is a streamlined fork of the original Clawdbot project, focused on:
- Core messaging channels (Signal, Telegram, Slack)
- Remote agent integration via blackbox RPC
- Lightweight server deployment
- Minimal dependencies
- Easy deployment and management

## Key Differences from Full Clawdbot

### Size
- **Full Clawdbot**: ~500MB with all features
- **Lightweight**: ~50-100MB (80-90% reduction)

### Channels
| Channel | Full | Lightweight |
|---------|------|-------------|
| Signal | ✅ | ✅ |
| Telegram | ✅ | ✅ |
| Slack | ✅ | ✅ |
| WhatsApp | ✅ | ❌ |
| Discord | ✅ | ❌ |
| iMessage | ✅ | ❌ |
| Google Chat | ✅ | ❌ |
| Microsoft Teams | ✅ | ❌ |
| Matrix | ✅ | ❌ |
| Others | ✅ | ❌ |

### Features
| Feature | Full | Lightweight |
|---------|------|-------------|
| Gateway WebSocket | ✅ | ✅ |
| Remote Agent | ✅ | ✅ |
| Message Routing | ✅ | ✅ |
| Session Management | ✅ | ✅ |
| Web UI | ✅ | ❌ (optional) |
| Browser Automation | ✅ | ❌ |
| Canvas/A2UI | ✅ | ❌ |
| Voice Features | ✅ | ❌ |
| Mobile Apps | ✅ | ❌ |
| macOS App | ✅ | ❌ |
| Cron/Webhooks | ✅ | ❌ |
| Advanced Skills | ✅ | ❌ |

## Architecture

```
┌─────────────────────────────────────────┐
│     Signal / Telegram / Slack           │
│     (Message Channels)                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Gateway (WebSocket)             │
│         Port 18789 (loopback)           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Message Router                │   │
│  │   - Channel handlers            │   │
│  │   - Session management          │   │
│  │   - Access control              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Remote Agent (RPC)            │   │
│  │   - Blackbox integration        │   │
│  │   - Tool execution              │   │
│  │   - State management            │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Deployment Scenarios

### 1. Single Server (Recommended)
```
┌──────────────────────┐
│   Linux/macOS VPS    │
│                      │
│  ┌────────────────┐  │
│  │    Gateway     │  │
│  │  + Channels    │  │
│  │  + Agent       │  │
│  └────────────────┘  │
└──────────────────────┘
```

### 2. Docker Container
```
┌──────────────────────┐
│   Docker Host        │
│                      │
│  ┌────────────────┐  │
│  │  Container     │  │
│  │  - Gateway     │  │
│  │  - Channels    │  │
│  │  - Agent       │  │
│  │  - Volume      │  │
│  └────────────────┘  │
└──────────────────────┘
```

### 3. Multiple Instances
```
┌──────────────┐  ┌──────────────┐
│  Instance 1  │  │  Instance 2  │
│  (Telegram)  │  │  (Slack)     │
└──────────────┘  └──────────────┘
       │                  │
       └────────┬─────────┘
                │
         ┌──────────────┐
         │ Load Balancer│
         │  (optional)  │
         └──────────────┘
```

## File Structure

```
clawdbot-lightweight/
├── src/
│   ├── telegram/          # Telegram integration
│   ├── slack/             # Slack integration
│   ├── signal/            # Signal integration
│   ├── gateway/           # Gateway core
│   ├── agents/            # Agent runtime
│   ├── cli/               # CLI commands
│   ├── config/            # Configuration
│   ├── routing/           # Message routing
│   ├── channels/          # Channel abstractions
│   ├── auto-reply/        # Reply logic
│   ├── infra/             # Infrastructure
│   ├── logging/           # Logging
│   ├── process/           # Process management
│   ├── security/          # Security
│   ├── sessions/          # Session management
│   └── utils/             # Utilities
├── dist/                  # Built output
├── scripts/
│   └── (deployment scripts)
├── deploy.sh              # Main deployment script
├── cleanup-unused.sh      # Remove unused code
├── docker-compose.yml     # Docker Compose config
├── Dockerfile.lightweight # Lightweight Docker image
├── .env.example           # Environment template
├── DEPLOYMENT.md          # Deployment guide
├── QUICKSTART.md          # Quick start guide
├── CLEANUP.md             # Cleanup documentation
└── README.lightweight.md  # Main README
```

## Configuration

### Minimal Configuration
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

### Production Configuration
```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5",
    "workspace": "/var/lib/clawdbot/workspace"
  },
  "channels": {
    "telegram": {
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "allowFrom": ["@admin", "@user1"],
      "groups": {
        "*": {
          "requireMention": true
        }
      }
    },
    "slack": {
      "botToken": "${SLACK_BOT_TOKEN}",
      "appToken": "${SLACK_APP_TOKEN}",
      "allowFrom": ["U123ABC"],
      "dm": {
        "policy": "pairing"
      }
    },
    "signal": {
      "account": "${SIGNAL_ACCOUNT}",
      "allowFrom": ["+1234567890"]
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789,
    "auth": {
      "mode": "none"
    }
  },
  "logging": {
    "level": "info",
    "file": "/var/log/clawdbot/gateway.log"
  }
}
```

## Deployment Methods

### Method 1: Systemd (Linux)
```bash
./deploy.sh --service systemd
```
- Auto-starts on boot
- Managed by systemd
- Logs via journalctl
- Best for production Linux servers

### Method 2: PM2 (Cross-platform)
```bash
./deploy.sh --service pm2
```
- Cross-platform
- Process monitoring
- Auto-restart on failure
- Good for development and production

### Method 3: Docker
```bash
docker-compose up -d
```
- Isolated environment
- Easy updates
- Portable
- Good for containerized deployments

### Method 4: Manual
```bash
./deploy.sh --service manual
```
- Foreground process
- Direct control
- Good for testing

## Security Features

### Access Control
- **Allowlists**: Restrict who can message the bot
- **DM Pairing**: Require approval for new DM senders
- **Session Isolation**: Separate sessions per user/channel
- **Token Security**: Environment variables for sensitive data

### Network Security
- **Loopback Binding**: Gateway binds to 127.0.0.1 by default
- **No External Exposure**: Unless explicitly configured
- **TLS Support**: For production deployments

### Configuration Security
- **File Permissions**: `chmod 600` on config files
- **Environment Variables**: For sensitive tokens
- **No Hardcoded Secrets**: All secrets via env or config

## Monitoring

### Health Checks
```bash
# HTTP health endpoint
curl http://localhost:18789/health

# Channel status
npx clawdbot channels status --probe

# Gateway status
./deploy.sh --status
```

### Logs
```bash
# Systemd
journalctl -u clawdbot-gateway -f

# PM2
pm2 logs clawdbot-gateway

# Docker
docker-compose logs -f

# File
tail -f ~/.clawdbot/logs/gateway.log
```

### Metrics
- Message count per channel
- Response times
- Error rates
- Session activity

## Maintenance

### Updates
```bash
git pull
npm install
npm run build
./deploy.sh --restart
```

### Backups
```bash
# Backup configuration
cp ~/.clawdbot/clawdbot.json ~/.clawdbot/clawdbot.json.backup

# Backup sessions
tar -czf sessions-backup.tar.gz ~/.clawdbot/sessions/

# Backup credentials
tar -czf credentials-backup.tar.gz ~/.clawdbot/credentials/
```

### Cleanup
```bash
# Remove old logs
find ~/.clawdbot/logs/ -mtime +30 -delete

# Remove old sessions
find ~/.clawdbot/sessions/ -mtime +90 -delete

# Clear cache
rm -rf ~/.clawdbot/cache/
```

## Performance

### Resource Usage
- **Memory**: ~100-200MB base + ~50MB per active session
- **CPU**: Low (< 5% idle, spikes during message processing)
- **Disk**: ~100MB installation + logs/sessions
- **Network**: Minimal (only channel API calls)

### Scaling
- **Vertical**: Add more CPU/RAM for concurrent sessions
- **Horizontal**: Run multiple instances with different channels
- **Load Balancing**: Use reverse proxy for multiple instances

### Optimization
- Disable unused channels
- Limit session history length
- Use efficient AI models
- Enable response caching

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
lsof -i :18789
# Kill process or change port
GATEWAY_PORT=18790 ./deploy.sh
```

#### Channel Not Connecting
```bash
# Check configuration
npx clawdbot config get channels.telegram

# Probe channel
npx clawdbot channels probe telegram

# Check logs
tail -f ~/.clawdbot/logs/gateway.log
```

#### Agent Not Responding
```bash
# Test agent
npx clawdbot agent --message "test" --thinking low

# Check AI provider API key
echo $ANTHROPIC_API_KEY

# Check logs for errors
grep -i error ~/.clawdbot/logs/gateway.log
```

#### High Memory Usage
```bash
# Check active sessions
npx clawdbot sessions list

# Restart gateway
./deploy.sh --restart

# Reduce session history
# Edit config: agents.defaults.sessionHistoryLimit
```

## Migration from Full Clawdbot

### Step 1: Backup
```bash
# Backup full installation
tar -czf clawdbot-full-backup.tar.gz ~/.clawdbot/
```

### Step 2: Export Configuration
```bash
# Extract channel configs
npx clawdbot config get channels.telegram > telegram-config.json
npx clawdbot config get channels.slack > slack-config.json
npx clawdbot config get channels.signal > signal-config.json
```

### Step 3: Install Lightweight
```bash
git clone <lightweight-repo>
cd clawdbot-lightweight
npm install
npm run build
```

### Step 4: Import Configuration
```bash
# Edit ~/.clawdbot/clawdbot.json with exported configs
# Or use environment variables
```

### Step 5: Test
```bash
./deploy.sh --service manual
# Test each channel
```

### Step 6: Deploy
```bash
./deploy.sh --service systemd
```

## Use Cases

### 1. Personal Assistant
- Single user
- Multiple channels
- Private server
- Full AI access

### 2. Team Bot
- Multiple users
- Allowlist-based access
- Shared workspace
- Team channels (Slack/Telegram groups)

### 3. Customer Support
- Public-facing
- DM pairing enabled
- Rate limiting
- Audit logging

### 4. Development Bot
- Testing environment
- Multiple instances
- Quick iteration
- Local development

## Roadmap

### Current Version (1.0)
- ✅ Signal, Telegram, Slack support
- ✅ Remote agent integration
- ✅ Deployment scripts
- ✅ Docker support
- ✅ Documentation

### Future Enhancements
- [ ] Web UI (optional add-on)
- [ ] Metrics dashboard
- [ ] Multi-tenant support
- [ ] Plugin system for custom channels
- [ ] Advanced rate limiting
- [ ] Message queuing
- [ ] Clustering support

## Support

### Documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [CLEANUP.md](CLEANUP.md) - Cleanup documentation
- [README.lightweight.md](README.lightweight.md) - Main README

### Troubleshooting
1. Check logs first
2. Verify configuration
3. Test individual components
4. Review original Clawdbot docs

### Community
- Original Clawdbot: https://github.com/clawdbot/clawdbot
- Issues: Use GitHub issues for bugs
- Discussions: For questions and ideas

## License

MIT License (same as original Clawdbot)

## Credits

Based on [Clawdbot](https://github.com/clawdbot/clawdbot) by Peter Steinberger and contributors.

This lightweight version is optimized for server deployments with core messaging channels.
