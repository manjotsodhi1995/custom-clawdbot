# Clawdbot Lightweight - Documentation Index

Complete documentation for the lightweight Clawdbot deployment.

## Quick Links

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Comprehensive deployment guide
- **[LIGHTWEIGHT-SUMMARY.md](LIGHTWEIGHT-SUMMARY.md)** - Complete overview
- **[README.lightweight.md](README.lightweight.md)** - Main README

## Getting Started

### New Users
1. Read [QUICKSTART.md](QUICKSTART.md)
2. Follow deployment steps
3. Test with a simple message
4. Configure channels as needed

### Existing Clawdbot Users
1. Read [CLEANUP.md](CLEANUP.md) to understand changes
2. Review [LIGHTWEIGHT-SUMMARY.md](LIGHTWEIGHT-SUMMARY.md) for migration
3. Export your current configuration
4. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for setup

## Documentation Structure

### Core Documentation

#### [QUICKSTART.md](QUICKSTART.md)
- Prerequisites
- Token setup (Telegram, Slack, Signal)
- Installation steps
- Basic configuration
- Testing
- Common issues

#### [DEPLOYMENT.md](DEPLOYMENT.md)
- Deployment script usage
- Configuration reference
- Service management (systemd, PM2, Docker)
- Health checks
- Logging
- Troubleshooting
- Security best practices

#### [README.lightweight.md](README.lightweight.md)
- Features overview
- Quick start
- Requirements
- Configuration examples
- Usage examples
- Management commands
- Architecture diagram
- Docker instructions

#### [LIGHTWEIGHT-SUMMARY.md](LIGHTWEIGHT-SUMMARY.md)
- Complete overview
- Comparison with full Clawdbot
- Architecture details
- Deployment scenarios
- File structure
- Configuration examples
- Security features
- Monitoring
- Maintenance
- Performance tuning
- Migration guide
- Use cases

#### [CLEANUP.md](CLEANUP.md)
- Removed features
- Removed channels
- Removed platforms
- Removed dependencies
- Size reduction details
- Migration notes

## Scripts

### Deployment
- **`deploy.sh`** - Main deployment script
  - Systemd installation
  - PM2 setup
  - Manual start
  - Health checks
  - Status monitoring

### Cleanup
- **`cleanup-unused.sh`** - Remove unused code
  - Creates backup branch
  - Removes unused directories
  - Removes unused files
  - Cleans dependencies

## Configuration Files

### Templates
- **`.env.example`** - Environment variables template
- **`docker-compose.yml`** - Docker Compose configuration
- **`Dockerfile.lightweight`** - Lightweight Docker image

### Runtime
- **`~/.clawdbot/clawdbot.json`** - Main configuration
- **`~/.clawdbot/.env`** - Environment variables (optional)
- **`~/.clawdbot/sessions/`** - Session data
- **`~/.clawdbot/credentials/`** - Channel credentials
- **`~/.clawdbot/logs/`** - Log files

## Common Tasks

### Installation
```bash
# Quick install
git clone <repo>
cd clawdbot-lightweight
npm install
npm run build
./deploy.sh
```

### Configuration
```bash
# Edit environment
cp .env.example .env
nano .env

# Edit config
nano ~/.clawdbot/clawdbot.json
```

### Management
```bash
# Status
./deploy.sh --status

# Restart
./deploy.sh --restart

# Stop
./deploy.sh --stop

# Logs
journalctl -u clawdbot-gateway -f  # systemd
pm2 logs clawdbot-gateway          # PM2
docker-compose logs -f             # Docker
```

### Testing
```bash
# Health check
curl http://localhost:18789/health

# Channel status
npx clawdbot channels status

# Test agent
npx clawdbot agent --message "test"
```

### Troubleshooting
```bash
# Check logs
tail -f ~/.clawdbot/logs/gateway.log

# Probe channels
npx clawdbot channels probe telegram
npx clawdbot channels probe slack
npx clawdbot channels probe signal

# Verify config
npx clawdbot config get
```

## Channel Setup

### Telegram
1. Create bot with @BotFather
2. Get bot token
3. Set `TELEGRAM_BOT_TOKEN` or `channels.telegram.botToken`
4. Configure allowlist
5. Test with `/start`

### Slack
1. Create app at api.slack.com
2. Enable Socket Mode
3. Add bot scopes
4. Install to workspace
5. Get tokens (Bot + App)
6. Set `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN`
7. Invite bot to channels

### Signal
1. Install signal-cli
2. Register phone number
3. Verify with code
4. Set `SIGNAL_ACCOUNT` or `channels.signal.account`
5. Configure allowlist

## Deployment Scenarios

### Development
```bash
# Local, manual start
./deploy.sh --service manual

# Or with PM2
./deploy.sh --service pm2
```

### Production (Linux)
```bash
# Systemd service
./deploy.sh --service systemd

# Enable firewall (if needed)
sudo ufw allow 18789/tcp
```

### Docker
```bash
# Copy environment
cp .env.example .env
nano .env

# Start
docker-compose up -d

# Logs
docker-compose logs -f
```

### VPS/Cloud
```bash
# SSH to server
ssh user@server

# Clone and deploy
git clone <repo>
cd clawdbot-lightweight
npm install
npm run build
./deploy.sh --service systemd
```

## Security Checklist

- [ ] Gateway binds to loopback (127.0.0.1)
- [ ] Tokens in environment variables
- [ ] Config file permissions: `chmod 600 ~/.clawdbot/clawdbot.json`
- [ ] Allowlists configured for all channels
- [ ] DM pairing enabled for untrusted channels
- [ ] Regular updates scheduled
- [ ] Logs rotated
- [ ] Backups configured
- [ ] Firewall rules set (if exposing externally)
- [ ] TLS/SSL configured (if exposing externally)

## Monitoring Checklist

- [ ] Health endpoint responding: `curl http://localhost:18789/health`
- [ ] All channels connected: `npx clawdbot channels status --probe`
- [ ] Logs clean: `tail -f ~/.clawdbot/logs/gateway.log`
- [ ] Memory usage normal: `ps aux | grep clawdbot`
- [ ] Disk space available: `df -h ~/.clawdbot/`
- [ ] Sessions active: `npx clawdbot sessions list`

## Maintenance Schedule

### Daily
- Check health endpoint
- Review error logs
- Monitor resource usage

### Weekly
- Review channel status
- Check for updates
- Backup configuration

### Monthly
- Rotate logs
- Clean old sessions
- Update dependencies
- Review security settings

## Support Resources

### Documentation
- This index
- Individual doc files
- Inline code comments

### Original Clawdbot
- Repository: https://github.com/clawdbot/clawdbot
- Documentation: https://docs.clawd.bot
- Discord: https://discord.gg/clawd

### Troubleshooting
1. Check logs first
2. Review configuration
3. Test individual components
4. Search GitHub issues
5. Ask in discussions

## Version Information

- **Current Version**: 1.0.0 (Lightweight)
- **Based On**: Clawdbot 2026.1.26
- **Channels**: Signal, Telegram, Slack
- **Node.js**: >= 22
- **License**: MIT

## Contributing

This is a lightweight fork focused on core channels. For contributions:
1. Focus on Signal, Telegram, Slack
2. Keep dependencies minimal
3. Maintain deployment simplicity
4. Document changes
5. Test thoroughly

## Changelog

### 1.0.0 (Initial Release)
- Forked from Clawdbot 2026.1.26
- Removed unused channels and features
- Created deployment scripts
- Added Docker support
- Wrote comprehensive documentation
- Optimized for server deployment

## Next Steps

1. **First Time**: Read [QUICKSTART.md](QUICKSTART.md)
2. **Deploying**: Follow [DEPLOYMENT.md](DEPLOYMENT.md)
3. **Understanding**: Review [LIGHTWEIGHT-SUMMARY.md](LIGHTWEIGHT-SUMMARY.md)
4. **Using**: Check [README.lightweight.md](README.lightweight.md)
5. **Troubleshooting**: See [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section

## Quick Reference Card

```
┌─────────────────────────────────────────────┐
│         Clawdbot Lightweight                │
├─────────────────────────────────────────────┤
│ Deploy:     ./deploy.sh                     │
│ Status:     ./deploy.sh --status            │
│ Restart:    ./deploy.sh --restart           │
│ Stop:       ./deploy.sh --stop              │
│ Health:     curl localhost:18789/health     │
│ Channels:   npx clawdbot channels status    │
│ Agent:      npx clawdbot agent --message "" │
│ Logs:       tail -f ~/.clawdbot/logs/*.log  │
│ Config:     ~/.clawdbot/clawdbot.json       │
│ Env:        .env or ~/.clawdbot/.env        │
└─────────────────────────────────────────────┘
```

---

**Ready to deploy?** Start with [QUICKSTART.md](QUICKSTART.md)!
