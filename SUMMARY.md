# Clawdbot — Codebase Summary

> **Version:** 2026.1.26 · **License:** MIT · **Runtime:** Node.js ≥ 22 · **Language:** TypeScript (ESM)

## Overview

**Clawdbot** is a personal, self-hosted AI assistant that operates across multiple messaging channels (WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, Matrix, WebChat, and more). It is built around a local-first **Gateway** control plane that manages sessions, channels, tools, and events over WebSocket. The product includes companion apps for macOS, iOS, and Android, plus a rich CLI, a plugin/extension system, and a skills platform.

Created by **Peter Steinberger** and the community. The project is open-source on GitHub at [clawdbot/clawdbot](https://github.com/clawdbot/clawdbot).

---

## Project Statistics

| Metric | Count |
|---|---|
| Source files (`src/`) | ~1,615 TypeScript files |
| Test files (`src/`) | ~880 test files |
| Source lines of code | ~258,700 LOC |
| Extensions (plugins) | 29 |
| Skills (bundled) | 53 |
| Documentation pages | ~296 Markdown/MDX files |
| Companion apps | 3 (macOS, iOS, Android) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict, ESM modules) |
| Runtime | Node.js 22+ (Bun also supported for dev) |
| Package Manager | pnpm (monorepo with `pnpm-workspace.yaml`) |
| Build | `tsc` (TypeScript compiler) |
| Linting | Oxlint (`oxlint`) |
| Formatting | Oxfmt (`oxfmt`) |
| Testing | Vitest (V8 coverage, 70% thresholds) |
| Web Framework | Express 5 + Hono |
| WebSocket | `ws` library |
| AI Agent Core | `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai` |
| Schema Validation | TypeBox (`@sinclair/typebox`) + Zod + Ajv |
| macOS App | Swift / SwiftUI (Swift Package Manager) |
| iOS App | Swift / SwiftUI (XcodeGen) |
| Android App | Kotlin (Gradle / Jetpack Compose) |
| UI (Control/WebChat) | Lit + mini-lit (Vite bundled) |
| Browser Automation | Playwright Core + Chromium BiDi |
| Containerization | Docker (3 Dockerfiles) + Docker Compose |
| CI/CD | GitHub Actions (6 workflows) |

---

## Repository Structure

```
clawdbot/
├── src/                    # Core TypeScript source (~1,615 files, ~258K LOC)
│   ├── agents/             # AI agent runtime, tools, sandbox, skills
│   ├── gateway/            # WebSocket Gateway server, protocol, methods
│   ├── channels/           # Shared channel abstractions & routing
│   ├── cli/                # CLI wiring and argument parsing
│   ├── commands/           # CLI command implementations
│   ├── config/             # Configuration loading and schema
│   ├── providers/          # AI model provider integrations
│   ├── routing/            # Message routing logic
│   ├── sessions/           # Session management and persistence
│   ├── security/           # Security policies, sandboxing
│   ├── plugins/            # Plugin loader and lifecycle
│   ├── plugin-sdk/         # Public SDK for extension authors
│   ├── browser/            # Browser automation (Playwright/CDP)
│   ├── media/              # Media pipeline (images, audio, video)
│   ├── media-understanding/# Media analysis and transcription
│   ├── web/                # Web provider and WebChat
│   ├── wizard/             # Onboarding wizard
│   ├── tui/                # Terminal UI
│   ├── terminal/           # Terminal utilities, tables, palette
│   ├── discord/            # Discord channel (discord.js / Carbon)
│   ├── telegram/           # Telegram channel (grammY)
│   ├── slack/              # Slack channel (Bolt)
│   ├── signal/             # Signal channel (signal-cli)
│   ├── imessage/           # iMessage channel
│   ├── whatsapp/           # WhatsApp channel (Baileys)
│   ├── line/               # LINE channel
│   ├── cron/               # Cron job scheduling
│   ├── hooks/              # Lifecycle hooks
│   ├── tts/                # Text-to-speech
│   ├── memory/             # Memory/vector storage
│   ├── canvas-host/        # Canvas + A2UI host
│   ├── node-host/          # Device node host
│   ├── pairing/            # DM pairing and allowlists
│   ├── daemon/             # Daemon (launchd/systemd) management
│   ├── infra/              # Infrastructure (Tailscale, networking)
│   ├── logging/            # Structured logging
│   ├── shared/             # Shared utilities
│   ├── utils/              # General utilities
│   └── types/              # Shared TypeScript types
│
├── extensions/             # 29 channel/feature plugins (workspace packages)
│   ├── bluebubbles/        # BlueBubbles iMessage bridge
│   ├── discord/            # Discord extension
│   ├── googlechat/         # Google Chat
│   ├── matrix/             # Matrix protocol
│   ├── msteams/            # Microsoft Teams
│   ├── mattermost/         # Mattermost
│   ├── nostr/              # Nostr protocol
│   ├── twitch/             # Twitch chat
│   ├── voice-call/         # Voice call support
│   ├── memory-core/        # Memory extension core
│   ├── memory-lancedb/     # LanceDB vector memory
│   ├── lobster/            # Lobster theme extension
│   ├── copilot-proxy/      # Copilot proxy
│   ├── llm-task/           # LLM task runner
│   └── ...                 # + 14 more extensions
│
├── skills/                 # 53 bundled/managed skills
│   ├── github/             # GitHub integration
│   ├── notion/             # Notion integration
│   ├── discord/            # Discord actions
│   ├── slack/              # Slack actions
│   ├── coding-agent/       # Coding agent skill
│   ├── remote-code/        # Remote code execution
│   ├── canvas/             # Canvas skill
│   ├── weather/            # Weather lookup
│   ├── 1password/          # 1Password integration
│   ├── obsidian/           # Obsidian notes
│   ├── spotify-player/     # Spotify control
│   └── ...                 # + 42 more skills
│
├── apps/                   # Native companion apps
│   ├── macos/              # macOS menu bar app (Swift/SwiftUI)
│   ├── ios/                # iOS node app (Swift/SwiftUI)
│   ├── android/            # Android node app (Kotlin/Compose)
│   └── shared/             # Shared ClawdbotKit (Swift)
│
├── ui/                     # Control UI + WebChat (Lit/Vite)
│   ├── src/                # UI source
│   └── vite.config.ts      # Vite build config
│
├── docs/                   # ~296 documentation pages (Mintlify)
│   ├── channels/           # Channel setup guides
│   ├── concepts/           # Architecture, sessions, models
│   ├── gateway/            # Gateway operations
│   ├── platforms/          # Platform-specific guides
│   ├── tools/              # Tool documentation
│   ├── start/              # Getting started / onboarding
│   └── ...                 # + more sections
│
├── scripts/                # Build, release, test, and utility scripts
├── test/                   # Shared test setup and helpers
├── patches/                # pnpm dependency patches
├── git-hooks/              # Git hook scripts
├── assets/                 # Static assets (icons, placeholders)
└── .github/                # CI workflows and labeler config
```

---

## Architecture

```
Messaging Channels (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams, Matrix, WebChat, ...)
                │
                ▼
┌───────────────────────────────────┐
│           Gateway Server          │
│     (WebSocket control plane)     │
│      ws://127.0.0.1:18789        │
│                                   │
│  ┌─────────┐  ┌───────────────┐  │
│  │ Sessions │  │ Channel Router│  │
│  │ Manager  │  │  & Routing    │  │
│  └─────────┘  └───────────────┘  │
│  ┌─────────┐  ┌───────────────┐  │
│  │  Tools   │  │   Security    │  │
│  │  & Cron  │  │  & Sandbox    │  │
│  └─────────┘  └───────────────┘  │
│  ┌─────────┐  ┌───────────────┐  │
│  │ Plugins  │  │  Control UI   │  │
│  │ & Skills │  │  & WebChat    │  │
│  └─────────┘  └───────────────┘  │
└──────────────┬────────────────────┘
               │
    ┌──────────┼──────────────┐
    │          │              │
    ▼          ▼              ▼
Pi Agent    CLI Client    Companion Apps
 (RPC)    (clawdbot ...)  (macOS/iOS/Android)
```

### Key Subsystems

- **Gateway** — Single WebSocket server that acts as the control plane for all clients, channels, tools, and events. Supports Tailscale Serve/Funnel for remote access.
- **Pi Agent Runtime** — RPC-based AI agent with tool streaming, block streaming, model failover, and session management. Powered by `@mariozechner/pi-agent-core`.
- **Channel Router** — Routes inbound messages from any channel to the correct agent/session. Supports multi-agent routing, group isolation, mention gating, and DM pairing.
- **Session Model** — Manages conversation sessions with compaction, pruning, and per-session configuration (model, thinking level, verbose mode, etc.).
- **Plugin System** — Extensions are workspace packages under `extensions/`. They are loaded at runtime via the plugin SDK and can add new channels, tools, or features.
- **Skills Platform** — Bundled, managed, and workspace skills that extend the agent's capabilities. Skills are defined via `SKILL.md` files and can be installed/managed via the CLI or UI.
- **Media Pipeline** — Handles images, audio, video, transcription, and media understanding across all channels.
- **Browser Control** — Dedicated Chromium instance managed via Playwright/CDP for web automation tasks.
- **Canvas + A2UI** — Agent-driven visual workspace that can push UI updates to macOS/iOS/Android companion apps.
- **Voice Wake + Talk Mode** — Always-on speech recognition and continuous conversation on macOS/iOS/Android.

---

## Messaging Channels

### Core (built-in)
| Channel | Library/Protocol |
|---|---|
| WhatsApp | Baileys (Web) |
| Telegram | grammY |
| Slack | Bolt |
| Discord | discord.js / Carbon |
| Signal | signal-cli |
| iMessage | imsg (macOS only) |
| WebChat | Gateway WebSocket |

### Extensions (plugins)
| Channel | Extension |
|---|---|
| Google Chat | `extensions/googlechat` |
| Microsoft Teams | `extensions/msteams` |
| Matrix | `extensions/matrix` |
| BlueBubbles | `extensions/bluebubbles` |
| Zalo | `extensions/zalo` |
| Zalo Personal | `extensions/zalouser` |
| LINE | `extensions/line` |
| Mattermost | `extensions/mattermost` |
| Nostr | `extensions/nostr` |
| Twitch | `extensions/twitch` |
| Nextcloud Talk | `extensions/nextcloud-talk` |
| Tlon | `extensions/tlon` |
| Voice Call | `extensions/voice-call` |

---

## Companion Apps

| Platform | Language | Build System | Features |
|---|---|---|---|
| **macOS** | Swift / SwiftUI | Swift Package Manager | Menu bar control, Voice Wake, Talk Mode, WebChat, Canvas, debug tools |
| **iOS** | Swift / SwiftUI | XcodeGen | Canvas, Voice Wake, Talk Mode, camera, screen recording, Bonjour pairing |
| **Android** | Kotlin | Gradle (Jetpack Compose) | Canvas, Talk Mode, camera, screen recording, optional SMS |

Shared Swift code lives in `apps/shared/ClawdbotKit/`.

---

## Development

### Prerequisites
- Node.js ≥ 22
- pnpm (v10.23.0+)

### Key Commands

```bash
# Install dependencies
pnpm install

# Build (TypeScript compilation)
pnpm build

# Run CLI in dev mode
pnpm clawdbot ...

# Dev loop with auto-reload
pnpm gateway:watch

# Lint & format
pnpm lint          # oxlint
pnpm format        # oxfmt

# Tests
pnpm test          # vitest (parallel)
pnpm test:coverage # with V8 coverage
pnpm test:e2e      # end-to-end tests
pnpm test:live     # live tests (requires API keys)

# UI
pnpm ui:build      # Build Control UI + WebChat
pnpm ui:dev        # Dev server for UI

# Docker
docker compose up  # Full Docker setup
```

### Monorepo Structure

The project uses **pnpm workspaces** with three workspace roots:
1. `.` — Core CLI and Gateway
2. `ui` — Control UI and WebChat (Lit/Vite)
3. `extensions/*` — Channel and feature plugins

---

## Testing

- **Framework:** Vitest with V8 coverage provider
- **Coverage thresholds:** 70% lines/functions/statements, 55% branches
- **Test types:**
  - Unit tests: colocated `*.test.ts` files
  - E2E tests: `*.e2e.test.ts` files
  - Live tests: `*.live.test.ts` (require real API keys)
  - Docker E2E: onboarding, gateway network, plugin, QR import tests
- **CI:** GitHub Actions with 6 workflows (CI, Docker release, install smoke, labeler, workflow sanity, auto-response)

---

## Configuration

Minimal config at `~/.clawdbot/clawdbot.json`:

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-5"
  }
}
```

Full reference: [docs.clawd.bot/gateway/configuration](https://docs.clawd.bot/gateway/configuration)

---

## Security

- **DM Pairing:** Unknown senders receive a pairing code; must be approved via `clawdbot pairing approve`.
- **Sandbox Mode:** Non-main sessions can run in per-session Docker sandboxes.
- **Tool Allowlists/Denylists:** Configurable per-session tool access.
- **Tailscale Integration:** Serve (tailnet-only) or Funnel (public) with auth enforcement.
- **Doctor Command:** `clawdbot doctor` surfaces risky configurations and migration issues.

---

## Deployment Options

| Method | Description |
|---|---|
| **npm global install** | `npm install -g clawdbot@latest` |
| **Docker** | `Dockerfile` + `docker-compose.yml` |
| **Nix** | Declarative config via [nix-clawdbot](https://github.com/clawdbot/nix-clawdbot) |
| **Cloud platforms** | Guides for Fly.io, Render, Northflank, DigitalOcean, GCP, Oracle Cloud, Railway, Raspberry Pi |
| **From source** | `git clone` + `pnpm install` + `pnpm build` |

---

## Release Channels

| Channel | Description | npm dist-tag |
|---|---|---|
| **stable** | Tagged releases (`vYYYY.M.D`) | `latest` |
| **beta** | Prerelease tags (`vYYYY.M.D-beta.N`) | `beta` |
| **dev** | Moving head on `main` | `dev` |

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `@whiskeysockets/baileys` | WhatsApp Web protocol |
| `grammy` | Telegram Bot API |
| `@slack/bolt` | Slack app framework |
| `@buape/carbon` | Discord interactions |
| `playwright-core` | Browser automation |
| `sharp` | Image processing |
| `@mariozechner/pi-agent-core` | AI agent runtime |
| `@sinclair/typebox` | JSON Schema / TypeBox |
| `express` | HTTP server |
| `hono` | Lightweight HTTP framework |
| `ws` | WebSocket server/client |
| `commander` | CLI argument parsing |
| `croner` | Cron scheduling |
| `chokidar` | File watching |
| `zod` | Schema validation |

---

## Documentation

Documentation is hosted on **Mintlify** at [docs.clawd.bot](https://docs.clawd.bot) with ~296 pages covering:

- Getting started and onboarding wizard
- Channel setup guides (all 14+ channels)
- Gateway operations and configuration
- Platform guides (macOS, iOS, Android, Linux, Windows/WSL2)
- Tool documentation (browser, canvas, nodes, cron, skills)
- Architecture and concepts (agent loop, sessions, routing, presence)
- Security and troubleshooting
- Deployment guides for various cloud platforms
- API reference and protocol documentation

---

*Generated from codebase analysis on March 2, 2026.*
