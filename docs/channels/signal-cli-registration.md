---
summary: "Complete guide to registering a new Signal number with signal-cli and using it in Clawdbot"
read_when:
  - Setting up a new Signal number for the bot
  - Registering signal-cli from scratch
  - Troubleshooting Signal registration issues
---

# Signal-CLI Registration Guide

This guide covers registering a **new Signal number** with `signal-cli` and configuring it for use with Clawdbot. If you want to link an existing Signal account instead, see [Signal (signal-cli)](/channels/signal).

## Prerequisites

- **Java Runtime Environment (JRE)** 17 or higher
- A **phone number** that can receive SMS or voice calls (not currently registered with Signal)
- `signal-cli` installed on your system

## Installing signal-cli

### macOS (Homebrew)

```bash
brew install signal-cli
```

### Linux (Debian/Ubuntu)

```bash
# Install Java if not already installed
sudo apt update
sudo apt install openjdk-17-jre

# Download and install signal-cli
wget https://github.com/AsamK/signal-cli/releases/latest/download/signal-cli-<VERSION>.tar.gz
tar xf signal-cli-<VERSION>.tar.gz -C /opt
sudo ln -sf /opt/signal-cli-<VERSION>/bin/signal-cli /usr/local/bin/
```

Replace `<VERSION>` with the latest version from [signal-cli releases](https://github.com/AsamK/signal-cli/releases).

### Arch Linux

```bash
yay -S signal-cli
```

### Verify Installation

```bash
signal-cli --version
```

## Registering a New Number

### Step 1: Register the Number

Use the `register` command with your phone number in E.164 format (include country code):

```bash
signal-cli -u +15551234567 register
```

**Important**: 
- Replace `+15551234567` with your actual phone number
- Use `-u` (username) flag instead of `-a` (account) for registration
- After registration completes, you'll use `-a` for all other commands

You'll see output like:
```
Captcha required for verification (https://signalcaptchas.org/registration/generate.html)
```

**Note**: If you see `Rate Limited (RateLimitException)`, see the troubleshooting section below.

### Step 2: Complete the Captcha

1. Open the captcha URL in your browser: https://signalcaptchas.org/registration/generate.html
2. Complete the captcha challenge
3. Copy the `signalcaptcha://` URL from the result

### Step 3: Register with Captcha

```bash
signal-cli -u +15551234567 register --captcha 'signalcaptcha://signal-hcaptcha...'
```

Replace the captcha value with the one you copied. You should see:
```
Verification code sent to +15551234567
```

**Important**: Continue using `-u` flag during registration. Switch to `-a` only after verification is complete.

### Step 4: Verify the Number

Check your phone for the SMS verification code, then verify:

```bash
signal-cli -u +15551234567 verify CODE
```

Replace `CODE` with the 6-digit verification code you received.

**Alternative**: If you didn't receive an SMS, request a voice call:

```bash
signal-cli -u +15551234567 register --voice --captcha 'signalcaptcha://...'
```

**After successful verification**, you can now use `-a` flag for all subsequent commands.

### Step 5: Verify Registration Success

```bash
signal-cli -a +15551234567 receive
```

If successful, you'll see no errors. Your number is now registered!

## Setting Up the Daemon

For Clawdbot to communicate with signal-cli, you need to run it in daemon mode.

### Option 1: Let Clawdbot Manage the Daemon (Recommended)

Clawdbot can automatically start and manage the signal-cli daemon. Just configure it (see Configuration section below) with `autoStart: true` (default).

### Option 2: Run Daemon Manually

If you prefer to manage the daemon yourself (useful for debugging or shared environments):

```bash
signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
```

Keep this running in a terminal or use a process manager like `systemd`, `pm2`, or `screen`.

#### Using systemd (Linux)

Create `/etc/systemd/system/signal-cli.service`:

```ini
[Unit]
Description=signal-cli daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
Restart=on-failure
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

## Configuring Clawdbot

### Basic Configuration

Add to your `clawdbot.json`:

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "cliPath": "signal-cli",
      "dmPolicy": "pairing",
      "allowFrom": ["+15557654321"]  // Your personal number
    }
  }
}
```

### Configuration Options

- **`account`**: Your registered Signal number (E.164 format)
- **`cliPath`**: Path to signal-cli binary (use `which signal-cli` to find it)
- **`dmPolicy`**: Access control for DMs
  - `"pairing"` (recommended): Requires approval via pairing codes
  - `"allowlist"`: Only numbers in `allowFrom` can message
  - `"open"`: Anyone can message (not recommended)
  - `"disabled"`: No DMs accepted
- **`allowFrom`**: Array of allowed phone numbers (E.164 format)

### Advanced Configuration

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "cliPath": "/usr/local/bin/signal-cli",
      
      // Daemon settings
      "httpHost": "127.0.0.1",
      "httpPort": 8080,
      "autoStart": true,  // Let Clawdbot manage daemon
      "startupTimeoutMs": 30000,
      
      // Access control
      "dmPolicy": "pairing",
      "allowFrom": ["+15557654321"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["+15557654321"],
      
      // Message settings
      "textChunkLimit": 4000,
      "chunkMode": "newline",  // Split on paragraphs
      "mediaMaxMb": 8,
      "ignoreAttachments": false,
      
      // Features
      "sendReadReceipts": true,
      "ignoreStories": true,
      "historyLimit": 50,
      
      // Reactions
      "actions": {
        "reactions": true
      },
      "reactionLevel": "minimal"
    }
  }
}
```

### External Daemon Mode

If you're running the daemon separately (Option 2 above):

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+15551234567",
      "httpUrl": "http://127.0.0.1:8080",
      "autoStart": false  // Don't auto-spawn daemon
    }
  }
}
```

## Starting Clawdbot

Once configured, start the gateway:

```bash
clawdbot gateway
```

You should see:
```
[signal] starting provider (http://127.0.0.1:8080)
[signal] daemon started successfully
```

## Testing the Setup

### Send a Test Message

From your personal phone, send a message to the bot number.

If using `dmPolicy: "pairing"`, you'll receive a pairing code. Approve it:

```bash
clawdbot pairing list signal
clawdbot pairing approve signal ABC123
```

Then send another message - the bot should respond!

### Check Status

```bash
clawdbot status
```

Look for the Signal section showing:
- ✓ Configured
- ✓ Running
- Base URL: http://127.0.0.1:8080

## Troubleshooting

### "Captcha required" Error

**Solution**: Complete the captcha at https://signalcaptchas.org/registration/generate.html and use the `--captcha` flag.

### "Account +15551234567 is not registered"

**Solution**: Complete the registration and verification steps above.

### "Failed to connect to daemon"

**Possible causes**:
1. Daemon not running
2. Wrong port/host configuration
3. Firewall blocking connection

**Solutions**:
```bash
# Check if daemon is running
ps aux | grep signal-cli

# Test daemon manually
signal-cli -a +15551234567 daemon --http 127.0.0.1:8080

# Check port availability
lsof -i :8080
```

### "Java not found" or "JAVA_HOME not set"

**Solution**: Install Java 17+ and set JAVA_HOME:

```bash
# macOS
export JAVA_HOME=$(/usr/libexec/java_home)

# Linux (add to ~/.bashrc or ~/.zshrc)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
```

### Messages Not Received

**Check**:
1. Daemon is running: `systemctl status signal-cli` (if using systemd)
2. Clawdbot gateway is running: `clawdbot status`
3. Number is in allowFrom list (if using allowlist policy)
4. Pairing code approved (if using pairing policy)

**Debug**:
```bash
# Check signal-cli logs
signal-cli -a +15551234567 receive --timeout 60

# Check Clawdbot logs
clawdbot gateway --log-level debug
```

### "Rate limit exceeded" (429 Error)

Signal has strict rate limits for registration to prevent abuse. If you see `[429] Rate Limited (RateLimitException)`:

**Immediate solutions**:
1. **Wait 24-48 hours** before trying again with the same number
2. **Use a different phone number** that hasn't been used recently
3. **Try from a different IP address** (different network/VPN)
4. **Use the linking method instead** (see below)

**Alternative: Link an existing Signal account** (Recommended if rate-limited):
Instead of registering a new number, you can link signal-cli to an existing Signal account:

```bash
# Generate a QR code to link
signal-cli link -n "Clawdbot"
```

This will display a QR code. Scan it with your existing Signal app:
1. Open Signal on your phone
2. Go to Settings → Linked Devices
3. Tap "Link New Device"
4. Scan the QR code displayed by signal-cli

After linking, use the phone number from your linked account in the Clawdbot configuration.

**Why rate limits happen**:
- Signal aggressively limits new registrations to prevent spam
- Multiple registration attempts from the same IP
- Using VoIP or virtual phone numbers
- Previous registration attempts with the same number

**Best practices to avoid rate limits**:
- Only attempt registration once per number per day
- Use a real mobile phone number (not VoIP)
- Ensure stable internet connection during registration
- Consider using the linking method for faster setup

### Daemon Crashes or Restarts

**Check Java memory**:
```bash
# Increase heap size if needed
JAVA_OPTS="-Xmx512m" signal-cli -a +15551234567 daemon --http 127.0.0.1:8080
```

**Use systemd** for automatic restarts (see systemd section above).

## Multi-Account Setup

To use multiple Signal numbers:

```json5
{
  "channels": {
    "signal": {
      "enabled": true,
      "accounts": {
        "bot1": {
          "enabled": true,
          "account": "+15551111111",
          "cliPath": "signal-cli",
          "httpPort": 8080,
          "dmPolicy": "pairing"
        },
        "bot2": {
          "enabled": true,
          "account": "+15552222222",
          "cliPath": "signal-cli",
          "httpPort": 8081,
          "dmPolicy": "pairing"
        }
      }
    }
  }
}
```

Each account needs its own daemon port.

## Security Best Practices

1. **Use a dedicated number**: Don't use your personal Signal number for the bot
2. **Enable pairing**: Use `dmPolicy: "pairing"` to control who can message
3. **Restrict groups**: Set `groupPolicy: "allowlist"` and specify allowed senders
4. **Keep signal-cli updated**: Regularly update to get security patches
5. **Secure the daemon**: Only bind to localhost (127.0.0.1) unless needed
6. **Backup registration**: The signal-cli data is stored in `~/.local/share/signal-cli/`

## Useful Commands

```bash
# List registered accounts
signal-cli -a +15551234567 listAccounts

# Send a test message
signal-cli -a +15551234567 send -m "Test message" +15557654321

# Receive messages (manual check)
signal-cli -a +15551234567 receive

# Update profile name
signal-cli -a +15551234567 updateProfile --name "Clawdbot"

# List contacts
signal-cli -a +15551234567 listContacts

# Join a group (if invited)
signal-cli -a +15551234567 receive
```

## Next Steps

- Read the full [Signal channel documentation](/channels/signal)
- Learn about [pairing and access control](/start/pairing)
- Configure [group chat settings](/gateway/configuration#group-chat-settings)
- Set up [message reactions](/channels/signal#reactions-message-tool)

## Additional Resources

- [signal-cli GitHub](https://github.com/AsamK/signal-cli)
- [signal-cli Wiki](https://github.com/AsamK/signal-cli/wiki)
- [Clawdbot Configuration Reference](/gateway/configuration)
- [Channel Troubleshooting](/channels/troubleshooting)
