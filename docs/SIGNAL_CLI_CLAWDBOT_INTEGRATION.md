---
title: "Complete Guide: Connecting Signal CLI with Clawdbot"
summary: "Step-by-step guide to integrate Signal messaging with Clawdbot using signal-cli"
version: "1.0"
last_updated: "2025-01-23"
---

# Complete Guide: Connecting Signal CLI with Clawdbot

This comprehensive guide walks you through the entire process of setting up Signal messaging with Clawdbot using `signal-cli`. By the end, you'll have a fully functional Signal bot that can receive and respond to messages.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Signal Number Setup](#signal-number-setup)
6. [Clawdbot Configuration](#clawdbot-configuration)
7. [Starting the System](#starting-the-system)
8. [Testing & Verification](#testing--verification)
9. [Advanced Configuration](#advanced-configuration)
10. [Troubleshooting](#troubleshooting)
11. [Security Best Practices](#security-best-practices)
12. [Maintenance & Updates](#maintenance--updates)

---

## Overview

### What You'll Build

A Signal-enabled AI assistant that:
- Receives messages on Signal
- Processes them through Clawdbot's AI engine
- Responds intelligently via Signal
- Supports both direct messages and group chats
- Maintains conversation context and history

### How It Works

```
Signal Message → signal-cli daemon → Clawdbot Gateway → AI Agent → Response → signal-cli → Signal
```

**Key Components:**
- **signal-cli**: Java-based Signal client that runs as a daemon
- **Clawdbot Gateway**: Central control plane that manages channels and agents
- **Signal Channel Plugin**: Bridges signal-cli and Clawdbot

---

## Prerequisites

### System Requirements

- **Operating System**: macOS, Linux, or Windows (via WSL2)
- **Java Runtime**: JRE 17 or higher
- **Node.js**: Version 22 or higher
- **Memory**: Minimum 2GB RAM (4GB recommended)
- **Storage**: 500MB free space

### Required Accounts

- **Signal Phone Number**: A phone number that can receive SMS/calls (not currently registered with Signal)
  - Can be a mobile number, landline with SMS, or VoIP number (some VoIP numbers may be rate-limited)
  - **Important**: Use a dedicated number for the bot, not your personal Signal account
- **Clawdbot Installation**: Working Clawdbot installation with gateway configured
- **AI Model Access**: Anthropic Claude or OpenAI API access

### Knowledge Prerequisites

- Basic command-line familiarity
- Understanding of JSON configuration files
- Basic networking concepts (ports, localhost)

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Signal Network                          │
│  (Your contacts send messages to your bot's Signal number)  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    signal-cli daemon                        │
│  • Runs on http://127.0.0.1:8080 (default)                 │
│  • Handles Signal protocol encryption/decryption            │
│  • Provides JSON-RPC API + Server-Sent Events (SSE)        │
│  • Manages Signal account registration & authentication    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Clawdbot Gateway (Port 18789)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Signal Channel Plugin                       │   │
│  │  • Connects to signal-cli via HTTP                  │   │
│  │  • Normalizes Signal messages to Clawdbot format    │   │
│  │  • Handles pairing/access control                   │   │
│  │  • Manages typing indicators & read receipts        │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                        │                                     │
│  ┌─────────────────────▼───────────────────────────────┐   │
│  │            Agent Runtime (Pi)                       │   │
│  │  • Processes messages with AI models                │   │
│  │  • Maintains conversation context                   │   │
│  │  • Executes tools and commands                      │   │
│  └─────────────────────┬───────────────────────────────┘   │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  AI Models   │
                  │ (Claude/GPT) │
                  └──────────────┘
```

### Data Flow

1. **Inbound Message Flow**:
   - User sends Signal message → Signal servers → signal-cli daemon
   - signal-cli emits SSE event → Clawdbot Signal plugin receives event
   - Plugin normalizes to Clawdbot message format → Gateway routes to agent
   - Agent processes with AI model → Generates response

2. **Outbound Message Flow**:
   - Agent generates response → Gateway routes to Signal plugin
   - Plugin chunks message if needed → Sends via signal-cli JSON-RPC API
   - signal-cli encrypts & sends → Signal servers → Recipient

---

## Installation

### Step 1: Install Java

Signal-cli requires Java 17 or higher.

#### macOS
```bash
# Using Homebrew
brew install openjdk@17

# Verify installation
java -version
```

#### Linux (Ubuntu/Debian)
```bash
# Install OpenJDK 17
sudo apt update
sudo apt install openjdk-17-jre

# Verify installation
java -version
```

#### Linux (Arch)
```bash
sudo pacman -S jre17-openjdk
java -version
```

#### Windows (WSL2)
```bash
# Inside WSL2 Ubuntu
sudo apt update
sudo apt install openjdk-17-jre
java -version
```

### Step 2: Install signal-cli

#### macOS (Homebrew)
```bash
brew install signal-cli

# Verify installation
signal-cli --version
```

#### Linux (Manual Installation)
```bash
# Download latest release
VERSION="0.13.5"  # Check https://github.com/AsamK/signal-cli/releases for latest
wget https://github.com/AsamK/signal-cli/releases/download/v${VERSION}/signal-cli-${VERSION}-Linux.tar.gz

# Extract
sudo tar xf signal-cli-${VERSION}-Linux.tar.gz -C /opt

# Create symlink
sudo ln -sf /opt/signal-cli-${VERSION}/bin/signal-cli /usr/local/bin/

# Verify
signal-cli --version
```

#### Arch Linux
```bash
yay -S signal-cli
signal-cli --version
```

### Step 3: Install/Verify Clawdbot

```bash
# Check if Clawdbot is installed
clawdbot --version

# If not installed, install globally
npm install -g clawdbot@latest

# Or with pnpm
pnpm add -g clawdbot@latest

# Verify gateway is configured
clawdbot status
```

---

## Signal Number Setup

You have two options for setting up your Signal number with signal-cli:

### Option A: Register a New Number (Recommended for Bots)

This is the recommended approach for dedicated bot numbers.

#### Step 1: Initiate Registration

```bash
# Replace with your phone number in E.164 format (+country_code + number)
signal-cli -u +15551234567 register
```

**Expected Output:**
```
Captcha required for verification (https://signalcaptchas.org/registration/generate.html)
```

#### Step 2: Complete Captcha

1. Open https://signalcaptchas.org/registration/generate.html in your browser
2. Complete the captcha challenge
3. Copy the `signalcaptcha://` URL from the result

#### Step 3: Register with Captcha

```bash
signal-cli -u +15551234567 register --captcha 'signalcaptcha://signal-hcaptcha.YOUR_CAPTCHA_TOKEN_HERE'
```

**Expected Output:**
```
Verification code sent to +15551234567
```

**Note**: If you see `Rate Limited (RateLimitException)`, see [Troubleshooting](#rate-limit-errors) below.

#### Step 4: Verify the Number

Check your phone for the SMS verification code (6 digits), then:

```bash
signal-cli -u +15551234567 verify 123456
```

Replace `123456` with your actual verification code.

**Alternative - Voice Call:**
If you didn't receive SMS:
```bash
signal-cli -u +15551234567 register --voice --captcha 'signalcaptcha://...'
```

#### Step 5: Confirm Registration

```bash
# This should complete without errors
signal-cli -a +15551234567 receive
```

**Important**: After successful verification, switch from `-u` flag to `-a` flag for all subsequent commands.

### Option B: Link an Existing Signal Account

If you want to link signal-cli to an existing Signal account (like a secondary device):

```bash
# Generate QR code for linking
signal-cli link -n "Clawdbot"
```

This displays a QR code. Scan it with your Signal app:
1. Open Signal on your phone
2. Go to **Settings** → **Linked Devices**
3. Tap **Link New Device**
4. Scan the displayed QR code

After linking, use the phone number from your linked account in Clawdbot configuration.

---

## Clawdbot Configuration

### Step 1: Locate Configuration File

Clawdbot configuration is stored at `~/.clawdbot/clawdbot.json`

```bash
# Check if config exists
ls -la ~/.clawdbot/clawdbot.json

# If it doesn't exist, create it
mkdir -p ~/.clawdbot
touch ~/.clawdbot/clawdbot.json
```

### Step 2: Basic Signal Configuration

Add the Signal channel configuration to your `clawdbot.json`:

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",  // Your registered Signal number
      "cliPath": "signal-cli",     // Path to signal-cli binary
      "dmPolicy": "pairing",       // Require pairing for DMs
      "allowFrom": [
        "+15557654321"             // Your personal number (can message bot)
      ]
    }
  }
}
```

### Step 3: Configure Access Control

#### DM Policy Options

- **`pairing`** (Recommended): Unknown senders get a pairing code; messages ignored until approved
- **`allowlist`**: Only numbers in `allowFrom` can message
- **`open`**: Anyone can message (requires `"*"` in `allowFrom`)
- **`disabled`**: No DMs accepted

#### Group Policy Options

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "dmPolicy": "pairing",
      "allowFrom": ["+15557654321"],
      
      // Group settings
      "groupPolicy": "allowlist",  // or "open" or "disabled"
      "groupAllowFrom": [
        "+15557654321"  // Who can trigger bot in groups
      ]
    }
  }
}
```

### Step 4: Advanced Configuration (Optional)

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "cliPath": "/usr/local/bin/signal-cli",  // Explicit path
      
      // Daemon settings
      "httpHost": "127.0.0.1",
      "httpPort": 8080,
      "autoStart": true,           // Let Clawdbot manage daemon
      "startupTimeoutMs": 30000,   // Wait up to 30s for daemon start
      
      // Access control
      "dmPolicy": "pairing",
      "allowFrom": ["+15557654321"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["+15557654321"],
      
      // Message handling
      "textChunkLimit": 4000,      // Max chars per message
      "chunkMode": "newline",      // Split on paragraphs
      "mediaMaxMb": 8,             // Max attachment size
      "ignoreAttachments": false,  // Process attachments
      
      // Features
      "sendReadReceipts": true,    // Send read receipts
      "ignoreStories": true,       // Ignore Signal stories
      "historyLimit": 50,          // Group chat history context
      
      // Reactions
      "actions": {
        "reactions": true          // Enable reaction support
      },
      "reactionLevel": "minimal"   // or "off", "ack", "extensive"
    }
  }
}
```

### Step 5: Multi-Account Setup (Optional)

To run multiple Signal bot accounts:

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "accounts": {
        "personal_bot": {
          "enabled": true,
          "account": "+15551111111",
          "cliPath": "signal-cli",
          "httpPort": 8080,
          "dmPolicy": "pairing"
        },
        "work_bot": {
          "enabled": true,
          "account": "+15552222222",
          "cliPath": "signal-cli",
          "httpPort": 8081,  // Different port!
          "dmPolicy": "allowlist",
          "allowFrom": ["+15553333333"]
        }
      }
    }
  }
}
```

**Important**: Each account needs its own unique port.

---

## Starting the System

### Option 1: Let Clawdbot Manage signal-cli (Recommended)

With `autoStart: true` (default), Clawdbot automatically starts and manages the signal-cli daemon.

```bash
# Start the gateway
clawdbot gateway

# Or with verbose logging
clawdbot gateway --verbose

# Or in background with daemon
clawdbot gateway --daemon
```

**Expected Output:**
```
[gateway] starting on port 18789
[signal] starting provider (http://127.0.0.1:8080)
[signal] spawning daemon: signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
[signal] daemon started successfully
[signal] connected to daemon
```

### Option 2: Manage signal-cli Manually

If you prefer to manage the daemon yourself:

#### Update Configuration

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "httpUrl": "http://127.0.0.1:8080",
      "autoStart": false  // Don't auto-spawn
    }
  }
}
```

#### Start signal-cli Daemon

```bash
# In a separate terminal
signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
```

Keep this running. Then start Clawdbot in another terminal:

```bash
clawdbot gateway
```

#### Using systemd (Linux)

Create `/etc/systemd/system/signal-cli.service`:

```ini
[Unit]
Description=signal-cli daemon for Clawdbot
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
Restart=on-failure
RestartSec=10
User=YOUR_USERNAME
Environment="HOME=/home/YOUR_USERNAME"

[Install]
WantedBy=multi-user.target
```

Replace `YOUR_USERNAME` and the phone number, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable signal-cli
sudo systemctl start signal-cli
sudo systemctl status signal-cli
```

#### Using launchd (macOS)

Create `~/Library/LaunchAgents/com.signal-cli.daemon.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.signal-cli.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/signal-cli</string>
        <string>-a</string>
        <string>+15551234567</string>
        <string>daemon</string>
        <string>--http</string>
        <string>127.0.0.1:8080</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/signal-cli.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/signal-cli.error.log</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.signal-cli.daemon.plist
launchctl start com.signal-cli.daemon
```

---

## Testing & Verification

### Step 1: Check Gateway Status

```bash
clawdbot status
```

**Expected Output:**
```
Gateway Status:
  Running: Yes
  Port: 18789
  Uptime: 2m 34s

Channels:
  signal:
    Status: Connected
    Account: +15551234567
    Daemon: http://127.0.0.1:8080
    DM Policy: pairing
    Group Policy: allowlist
```

### Step 2: Send Test Message

From your personal phone (the number in `allowFrom`), send a message to the bot's Signal number.

#### If Using Pairing Policy

You'll receive a pairing code response:

```
Pairing required. Your code: ABC123
This code expires in 1 hour.
```

Approve the pairing:

```bash
# List pending pairing requests
clawdbot pairing list signal

# Approve the code
clawdbot pairing approve signal ABC123
```

Now send another message - the bot should respond!

#### If Using Allowlist Policy

The bot should respond immediately since your number is in `allowFrom`.

### Step 3: Test Group Chat (Optional)

1. Create a Signal group
2. Add the bot's number to the group
3. Add your personal number to the group
4. Send a message mentioning the bot (if `requireMention` is set)

### Step 4: Verify Logs

```bash
# Check gateway logs
clawdbot gateway --verbose

# Or check signal-cli logs if running manually
tail -f /tmp/signal-cli.log  # macOS launchd
journalctl -u signal-cli -f  # Linux systemd
```

---

## Advanced Configuration

### Message Chunking

Signal has message length limits. Clawdbot automatically chunks long messages:

```json5
{
  "channels": {
    "signal": {
      "textChunkLimit": 4000,  // Characters per chunk
      "chunkMode": "newline"   // Split on paragraph boundaries
    }
  }
}
```

**Chunk Modes:**
- `length`: Split at character limit
- `newline`: Split on blank lines (paragraphs) before hitting limit

### Media Handling

```json5
{
  "channels": {
    "signal": {
      "mediaMaxMb": 8,            // Max attachment size
      "ignoreAttachments": false  // Set true to skip downloads
    }
  }
}
```

### Typing Indicators

Clawdbot sends typing indicators while processing:

```json5
{
  "channels": {
    "signal": {
      "sendTypingIndicators": true  // Default: true
    }
  }
}
```

### Read Receipts

```json5
{
  "channels": {
    "signal": {
      "sendReadReceipts": true  // Send read receipts for DMs
    }
  }
}
```

**Note**: Signal-cli doesn't expose read receipts for groups.

### Reactions

Enable the bot to react to messages:

```json5
{
  "channels": {
    "signal": {
      "actions": {
        "reactions": true
      },
      "reactionLevel": "minimal"  // off | ack | minimal | extensive
    }
  }
}
```

Use the `message` tool to react:

```bash
# React to a message
clawdbot agent --message "Use the message tool to react with 🔥 to message 1737630212345 from +15557654321"
```

### History Context

Control how much chat history is included as context:

```json5
{
  "channels": {
    "signal": {
      "historyLimit": 50,      // Group chat history (messages)
      "dmHistoryLimit": 20     // DM history (user turns)
    }
  }
}
```

Set to `0` to disable history context.

### Per-User DM Settings

Override settings for specific users:

```json5
{
  "channels": {
    "signal": {
      "dms": {
        "+15557654321": {
          "historyLimit": 100,  // More history for this user
          "model": "anthropic/claude-opus-4-5"  // Specific model
        }
      }
    }
  }
}
```

---

## Troubleshooting

### Rate Limit Errors

**Problem**: `[429] Rate Limited (RateLimitException)` during registration

**Causes**:
- Multiple registration attempts from same IP
- Using VoIP or virtual phone numbers
- Signal's anti-spam protection

**Solutions**:

1. **Wait 24-48 hours** before trying again
2. **Use a different phone number**
3. **Try from a different IP** (different network/VPN)
4. **Use linking instead** (Option B above)

### Daemon Connection Failed

**Problem**: `Failed to connect to daemon` or `ECONNREFUSED`

**Diagnosis**:
```bash
# Check if daemon is running
ps aux | grep signal-cli

# Check if port is in use
lsof -i :8080

# Test daemon directly
curl http://127.0.0.1:8080/v1/about
```

**Solutions**:

1. **Start the daemon manually**:
   ```bash
   signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
   ```

2. **Check port conflicts**:
   ```bash
   # If port 8080 is taken, use a different port
   signal-cli -a +15551234567 daemon --http 127.0.0.1:8081
   ```
   
   Update `clawdbot.json`:
   ```json5
   {
     "channels": {
       "signal": {
         "httpPort": 8081
       }
     }
   }
   ```

3. **Check firewall**:
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
   
   # Linux
   sudo ufw status
   ```

### Messages Not Received

**Problem**: Bot doesn't respond to messages

**Diagnosis**:
```bash
# Check gateway logs
clawdbot gateway --verbose

# Test signal-cli directly
signal-cli -a +15551234567 receive --timeout 60
```

**Solutions**:

1. **Check allowlist**:
   - Verify sender's number is in `allowFrom`
   - For pairing policy, approve the pairing code

2. **Check daemon logs**:
   ```bash
   # If using systemd
   journalctl -u signal-cli -f
   
   # If using launchd
   tail -f /tmp/signal-cli.log
   ```

3. **Verify account registration**:
   ```bash
   signal-cli -a +15551234567 listAccounts
   ```

### Java Not Found

**Problem**: `java: command not found` or `JAVA_HOME not set`

**Solution**:

```bash
# macOS
export JAVA_HOME=$(/usr/libexec/java_home)
echo 'export JAVA_HOME=$(/usr/libexec/java_home)' >> ~/.zshrc

# Linux
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc

# Reload shell
source ~/.zshrc  # or ~/.bashrc
```

### Daemon Crashes

**Problem**: signal-cli daemon keeps crashing

**Solutions**:

1. **Increase Java heap size**:
   ```bash
   JAVA_OPTS="-Xmx512m" signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
   ```

2. **Check disk space**:
   ```bash
   df -h ~/.local/share/signal-cli
   ```

3. **Clear cache** (last resort):
   ```bash
   # Backup first!
   cp -r ~/.local/share/signal-cli ~/.local/share/signal-cli.backup
   
   # Clear cache
   rm -rf ~/.local/share/signal-cli/data/+15551234567/cache
   ```

### Pairing Codes Not Working

**Problem**: Pairing codes expire or don't work

**Solutions**:

1. **Check code expiry** (1 hour):
   ```bash
   clawdbot pairing list signal
   ```

2. **Request new code**:
   - Have sender send another message
   - New code will be generated

3. **Manually add to allowlist**:
   ```json5
   {
     "channels": {
       "signal": {
         "allowFrom": [
           "+15557654321",
           "uuid:123e4567-e89b-12d3-a456-426614174000"  // UUID format
         ]
       }
     }
   }
   ```

---

## Security Best Practices

### 1. Use Dedicated Bot Number

**Never use your personal Signal number for the bot.**

- Get a separate number (Google Voice, Twilio, etc.)
- Keeps personal and bot communications separate
- Easier to manage and troubleshoot

### 2. Enable Pairing for DMs

```json5
{
  "channels": {
    "signal": {
      "dmPolicy": "pairing"  // Require approval for new contacts
    }
  }
}
```

This prevents random people from messaging your bot.

### 3. Restrict Group Access

```json5
{
  "channels": {
    "signal": {
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["+15557654321"]  // Only you can trigger in groups
    }
  }
}
```

### 4. Bind Daemon to Localhost

**Never expose signal-cli daemon to the internet.**

```bash
# Good - localhost only
signal-cli -a +15551234567 daemon --http 127.0.0.1:8080

# Bad - exposed to network
signal-cli -a +15551234567 daemon --http 0.0.0.0:8080
```

### 5. Regular Backups

```bash
# Backup signal-cli data
tar -czf signal-cli-backup-$(date +%Y%m%d).tar.gz ~/.local/share/signal-cli

# Backup Clawdbot config
cp ~/.clawdbot/clawdbot.json ~/.clawdbot/clawdbot.json.backup
```

### 6. Monitor Logs

```bash
# Set up log rotation
# Add to /etc/logrotate.d/signal-cli
/tmp/signal-cli.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

### 7. Update Regularly

```bash
# Update signal-cli
brew upgrade signal-cli  # macOS

# Or manually check for updates
# https://github.com/AsamK/signal-cli/releases

# Update Clawdbot
npm update -g clawdbot
```

---

## Maintenance & Updates

### Updating signal-cli

```bash
# macOS (Homebrew)
brew upgrade signal-cli

# Linux (manual)
# Download new version from GitHub releases
# Extract and replace old installation
```

### Updating Clawdbot

```bash
# Check current version
clawdbot --version

# Update to latest
npm update -g clawdbot

# Or specific version
npm install -g clawdbot@2025.1.23
```

### Monitoring Health

```bash
# Check gateway status
clawdbot status

# Check signal-cli daemon
curl http://127.0.0.1:8080/v1/about

# View recent logs
clawdbot gateway --verbose | tail -n 100
```

### Backup Strategy

```bash
#!/bin/bash
# backup-signal-bot.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/signal-bot-backups"

mkdir -p "$BACKUP_DIR"

# Backup signal-cli data
tar -czf "$BACKUP_DIR/signal-cli-$DATE.tar.gz" \
    ~/.local/share/signal-cli

# Backup Clawdbot config
cp ~/.clawdbot/clawdbot.json \
    "$BACKUP_DIR/clawdbot-$DATE.json"

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.json" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Run daily via cron:
```bash
# Add to crontab
0 2 * * * /path/to/backup-signal-bot.sh
```

---

## Quick Reference

### Common Commands

```bash
# Start gateway
clawdbot gateway

# Check status
clawdbot status

# List pairing requests
clawdbot pairing list signal

# Approve pairing
clawdbot pairing approve signal ABC123

# Send test message
clawdbot message send --to +15551234567 --message "Hello from Clawdbot"

# Check signal-cli accounts
signal-cli -a +15551234567 listAccounts

# Receive messages manually
signal-cli -a +15551234567 receive --timeout 60

# Start daemon manually
signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
```

### Configuration Templates

**Minimal**:
```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "dmPolicy": "pairing"
    }
  }
}
```

**Production**:
```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "cliPath": "/usr/local/bin/signal-cli",
      "httpHost": "127.0.0.1",
      "httpPort": 8080,
      "autoStart": true,
      "dmPolicy": "pairing",
      "allowFrom": ["+15557654321"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["+15557654321"],
      "textChunkLimit": 4000,
      "chunkMode": "newline",
      "sendReadReceipts": true,
      "historyLimit": 50
    }
  }
}
```

---

## Additional Resources

### Official Documentation

- [Clawdbot Signal Channel Docs](https://docs.clawd.bot/channels/signal)
- [Signal-CLI Registration Guide](https://docs.clawd.bot/channels/signal-cli-registration)
- [signal-cli GitHub](https://github.com/AsamK/signal-cli)
- [signal-cli Wiki](https://github.com/AsamK/signal-cli/wiki)

### Community Support

- [Clawdbot Discord](https://discord.gg/clawd)
- [GitHub Issues](https://github.com/clawdbot/clawdbot/issues)
- [Clawdbot Documentation](https://docs.clawd.bot)

### Related Guides

- [Gateway Configuration Reference](https://docs.clawd.bot/gateway/configuration)
- [Security Best Practices](https://docs.clawd.bot/gateway/security)
- [Pairing & Access Control](https://docs.clawd.bot/start/pairing)
- [Channel Troubleshooting](https://docs.clawd.bot/channels/troubleshooting)

---

## Conclusion

You now have a complete Signal bot integrated with Clawdbot! Your bot can:

✅ Receive and respond to Signal messages  
✅ Handle both DMs and group chats  
✅ Maintain conversation context  
✅ Process attachments and media  
✅ Send reactions and typing indicators  
✅ Enforce access control via pairing or allowlists  

**Next Steps:**

1. Customize your bot's personality via `~/clawd/SOUL.md`
2. Add custom skills to `~/clawd/skills/`
3. Configure additional channels (WhatsApp, Telegram, etc.)
4. Set up automated backups
5. Monitor and optimize performance

Happy botting! 🦞
