# Clawdbot Fork - Running Locally & Building for Publish

This guide covers how to run the clawdbot-fork project locally and how to build it for publishing.

## Prerequisites

- **Node.js**: Version ≥22.12.0 (check with `node --version`)
- **pnpm**: Version 10.23.0 (specified in `package.json`)
  - Install: `npm install -g pnpm@10.23.0`
- **Git**: For cloning and version control

## Running Locally

### 1. Install Dependencies

```bash
cd clawdbot-fork
pnpm install
```

This installs all dependencies for the monorepo (root, `ui`, and `extensions/*`).

### 2. Build the Project

```bash
# Build UI (auto-installs UI deps on first run)
pnpm ui:build

# Build TypeScript to dist/
pnpm build
```

The `build` command:
- Bundles A2UI canvas components
- Compiles TypeScript to JavaScript in `dist/`
- Copies hook metadata and writes build info

### 3. Run the Gateway (Development)

You have several options for running in development:

#### Option A: Development Mode (Auto-reload on changes)
```bash
# Watches for TypeScript changes and auto-reloads
pnpm gateway:watch
```

#### Option B: Standard Development
```bash
# Runs gateway in dev mode (skips channels)
pnpm gateway:dev

# Or with reset
pnpm gateway:dev:reset
```

#### Option C: Direct CLI Commands
```bash
# Run any clawdbot command directly (uses tsx to run TypeScript)
pnpm clawdbot <command>

# Examples:
pnpm clawdbot onboard --install-daemon
pnpm clawdbot gateway --port 18789 --verbose
pnpm clawdbot agent --message "Hello"
```

#### Option D: Standard Start
```bash
# Runs via run-node.mjs (builds if needed)
pnpm dev
# or
pnpm start
```

### 4. First-Time Setup (Onboarding)

After building, run the onboarding wizard:

```bash
pnpm clawdbot onboard --install-daemon
```

This walks you through:
- Gateway setup
- Workspace configuration
- Channel configuration (WhatsApp, Telegram, etc.)
- Skills setup

### 5. Verify Installation

```bash
# Check version
pnpm clawdbot --version

# Get help
pnpm clawdbot --help

# Test gateway
pnpm clawdbot gateway --port 18789 --verbose
```

## Building for Publishing

### Overview

The project uses a standard npm publishing workflow. The build process creates a `dist/` directory with compiled JavaScript that gets packaged and published to npm.

### Step-by-Step Build Process

#### 1. Pre-Build Checks

```bash
# Ensure dependencies are up to date
pnpm install

# Lint the codebase
pnpm lint

# Run tests
pnpm test
# or with coverage
pnpm test:coverage
```

#### 2. Update Version & Metadata

Before building for release:

```bash
# 1. Update version in package.json (e.g., "2026.1.26")
# Edit package.json manually or use npm version

# 2. Sync plugin versions (if needed)
pnpm plugins:sync

# 3. Update version strings in:
#    - src/cli/program.ts
#    - src/provider-web.ts (Baileys user agent)
```

#### 3. Build the Project

```bash
# Build A2UI bundle (if canvas components changed)
pnpm canvas:a2ui:bundle

# Build TypeScript to dist/
pnpm build
```

This creates:
- `dist/` - Compiled JavaScript
- `dist/build-info.json` - Build metadata with commit hash
- All required subdirectories (`dist/agents/`, `dist/gateway/`, etc.)

#### 4. Verify Build Output

```bash
# Check that dist/entry.js exists (CLI entry point)
ls dist/entry.js

# Verify build-info.json
cat dist/build-info.json

# Run release check (validates npm pack contents)
pnpm release:check
```

#### 5. Test Package Contents

```bash
# Create a test tarball (dry run)
npm pack --dry-run

# Create actual tarball for inspection
npm pack --pack-destination /tmp
# Inspect: tar -tzf /tmp/clawdbot-*.tgz | head -20
```

#### 6. Publish to npm

**Important**: Only publish if you have npm publishing rights!

```bash
# 1. Ensure git is clean
git status

# 2. Login to npm (if needed)
npm login

# 3. Publish
npm publish --access public

# For beta/pre-release:
npm publish --access public --tag beta

# 4. Verify publication
npm view clawdbot version
npm view clawdbot dist-tags

# 5. Test install
npx -y clawdbot@<version> --version
```

### Package Contents

The `package.json` `files` field controls what gets published. It includes:
- `dist/**` - All compiled code
- `docs/**` - Documentation
- `extensions/**` - Plugin extensions
- `assets/**` - Static assets
- `skills/**` - Skills directory
- `README.md`, `CHANGELOG.md`, `LICENSE`

**Excluded**: `dist/Clawdbot.app` (macOS app bundle) - not published to npm

### Build Scripts Reference

From `package.json`:

| Script | Description |
|--------|-------------|
| `pnpm build` | Main build: bundles A2UI, compiles TS, copies metadata |
| `pnpm ui:build` | Builds the UI package |
| `pnpm prepack` | Runs before `npm pack`: builds + UI build |
| `pnpm release:check` | Validates npm pack contents |
| `pnpm canvas:a2ui:bundle` | Bundles A2UI canvas components |

### Development vs Production Builds

- **Development**: Uses `tsx` to run TypeScript directly (no build needed)
  - `pnpm clawdbot <command>` runs via `tsx`
  - `pnpm gateway:watch` watches and rebuilds on changes

- **Production**: Requires `pnpm build` to create `dist/`
  - Published npm package uses `dist/` files
  - Binary entry point: `dist/entry.js`

## Troubleshooting

### Build Issues

```bash
# Clean and rebuild
rm -rf dist node_modules
pnpm install
pnpm build

# Check TypeScript errors
pnpm build 2>&1 | grep -i error
```

### Runtime Issues

```bash
# Check Node version
node --version  # Must be ≥22.12.0

# Check pnpm version
pnpm --version  # Should be 10.23.0

# Verify build output
ls -la dist/entry.js
```

### Publishing Issues

- **Large tarball**: Check that `dist/Clawdbot.app` is excluded (it should be)
- **Missing files**: Verify `package.json` `files` array includes needed directories
- **Auth issues**: Use `npm login` and ensure 2FA is configured

## Additional Resources

- **Full Release Guide**: `docs/reference/RELEASING.md`
- **macOS App Release**: `docs/platforms/mac/release.md`
- **Getting Started**: `README.md` (main project README)
- **Configuration**: `docs/clawd.bot/gateway/configuration`

## Quick Reference

```bash
# Local Development
pnpm install
pnpm ui:build
pnpm build
pnpm gateway:watch

# Build for Publish
pnpm lint
pnpm test
pnpm build
pnpm release:check
npm pack --dry-run
npm publish --access public
```
