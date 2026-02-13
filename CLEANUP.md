# Cleanup Summary

This document tracks what was removed from the original Clawdbot to create this lightweight version.

## Removed Channels

- ❌ WhatsApp (Baileys integration)
- ❌ Discord
- ❌ iMessage
- ❌ Google Chat
- ❌ Microsoft Teams (extension)
- ❌ Matrix (extension)
- ❌ Zalo (extension)
- ❌ Zalo Personal (extension)
- ❌ BlueBubbles (extension)
- ❌ Nostr (extension)
- ❌ Nextcloud Talk (extension)
- ❌ Mattermost (extension)
- ❌ LINE
- ❌ Twitch (extension)
- ❌ Tlon (extension)

## Retained Channels

- ✅ Signal
- ✅ Telegram
- ✅ Slack

## Removed Platform Apps

- ❌ macOS menu bar app (`apps/macos/`)
- ❌ iOS app (`apps/ios/`)
- ❌ Android app (`apps/android/`)
- ❌ Shared mobile kit (`apps/shared/`)

## Removed Features

### UI & Frontend
- ❌ Web Control UI (`ui/`)
- ❌ WebChat interface
- ❌ Canvas/A2UI system
- ❌ Chrome extension (`assets/chrome-extension/`)

### Voice & Media
- ❌ Voice Wake
- ❌ Talk Mode
- ❌ TTS (text-to-speech)
- ❌ Audio transcription
- ❌ Video frame extraction

### Browser & Automation
- ❌ Browser control (Playwright)
- ❌ Browser profiles
- ❌ Browser login automation

### Advanced Tools
- ❌ Cron jobs
- ❌ Webhooks
- ❌ Gmail Pub/Sub
- ❌ Node system (device pairing)
- ❌ Canvas rendering
- ❌ Camera/screen capture
- ❌ Location services

### Skills
Most bundled skills removed, keeping only:
- ✅ Core agent skills
- ✅ Session management
- ❌ 1Password integration
- ❌ Apple Notes/Reminders
- ❌ Bear Notes
- ❌ Notion
- ❌ Obsidian
- ❌ Spotify
- ❌ Trello
- ❌ GitHub
- ❌ Discord skills
- ❌ Slack skills (advanced)
- ❌ OpenAI Whisper
- ❌ Image generation
- ❌ Video processing
- ❌ And many more...

### Extensions
- ❌ Memory extensions (LanceDB)
- ❌ LLM Task extension
- ❌ Lobster extension
- ❌ Copilot Proxy
- ❌ OpenProse
- ❌ Diagnostics (OpenTelemetry)
- ❌ Google Gemini auth
- ❌ Google Antigravity auth
- ❌ Qwen Portal auth

### Development & Testing
- ❌ Mobile test suites
- ❌ E2E tests for removed features
- ❌ Browser tests
- ❌ Docker test scripts
- ❌ Platform-specific tests

### Documentation
- ❌ Platform-specific docs (iOS, Android, macOS)
- ❌ Removed channel docs
- ❌ Advanced feature docs
- ❌ Mintlify docs site (`docs/`)

### Build & Packaging
- ❌ macOS app packaging scripts
- ❌ iOS build scripts
- ❌ Android build scripts
- ❌ Code signing scripts
- ❌ Notarization scripts
- ❌ DMG creation
- ❌ Xcode project generation

### Infrastructure
- ❌ Tailscale integration
- ❌ Bonjour/mDNS discovery
- ❌ SSH tunnel management
- ❌ Remote gateway helpers
- ❌ LaunchAgent/systemd templates (kept minimal versions)

## Retained Core Features

### Gateway
- ✅ WebSocket server
- ✅ Session management
- ✅ Message routing
- ✅ Configuration system
- ✅ Health checks
- ✅ Basic HTTP server

### Agent
- ✅ RPC agent runtime
- ✅ Tool execution
- ✅ Session state
- ✅ Message history
- ✅ Model integration (Anthropic, OpenAI)

### Channels (Core 3)
- ✅ Signal integration
- ✅ Telegram bot
- ✅ Slack bot
- ✅ Message formatting
- ✅ Media handling (basic)
- ✅ Typing indicators
- ✅ Reactions

### Security
- ✅ DM pairing
- ✅ Allowlists
- ✅ Token management
- ✅ Session isolation

### CLI
- ✅ Gateway commands
- ✅ Agent commands
- ✅ Channel commands
- ✅ Configuration commands
- ✅ Status/probe commands

## File Structure Changes

### Removed Directories
```
apps/                    # All platform apps
ui/                      # Web UI
extensions/              # Most extensions (kept core structure)
docs/                    # Documentation site
skills/                  # Most skills
scripts/mac-*            # macOS scripts
scripts/ios-*            # iOS scripts
scripts/android-*        # Android scripts
scripts/mobile-*         # Mobile scripts
scripts/package-*        # Packaging scripts
scripts/notarize-*       # Notarization scripts
scripts/codesign-*       # Code signing scripts
```

### Retained Directories
```
src/
  ├── telegram/          # Telegram integration
  ├── slack/             # Slack integration
  ├── signal/            # Signal integration
  ├── gateway/           # Gateway core
  ├── agents/            # Agent runtime
  ├── cli/               # CLI commands
  ├── config/            # Configuration
  ├── routing/           # Message routing
  ├── auto-reply/        # Reply logic
  ├── channels/          # Channel abstractions
  ├── infra/             # Infrastructure
  ├── logging/           # Logging
  ├── process/           # Process management
  ├── security/          # Security
  ├── sessions/          # Session management
  └── utils/             # Utilities
```

## Dependencies Removed

### Major Dependencies
- `@whiskeysockets/baileys` - WhatsApp
- `discord.js` / `discord-api-types` - Discord
- `playwright-core` - Browser automation
- `@napi-rs/canvas` - Canvas rendering
- `@lydell/node-pty` - Terminal emulation
- `node-edge-tts` - Text-to-speech
- `sharp` - Image processing (kept for basic media)
- Various mobile/platform-specific packages

### Retained Dependencies
- `grammy` - Telegram
- `@slack/bolt` - Slack
- `@slack/web-api` - Slack API
- Signal-cli (external)
- Core Node.js packages
- AI provider SDKs

## Size Reduction

Estimated size reduction:
- **Before**: ~500MB (with all features)
- **After**: ~50-100MB (lightweight version)
- **Reduction**: ~80-90% smaller

## Migration Notes

If you need removed features:
1. Check the original Clawdbot repository
2. Review git history for specific components
3. Consider using the full version for advanced features
4. This lightweight version is optimized for Signal/Telegram/Slack only

## Maintenance

This cleanup maintains:
- Core gateway functionality
- Three primary channels
- Remote agent integration
- Essential security features
- Basic deployment tooling

For full feature set, use the original Clawdbot repository.
