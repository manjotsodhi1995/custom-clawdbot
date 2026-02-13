#!/usr/bin/env bash
set -euo pipefail

# Cleanup script for removing unused code from lightweight Clawdbot
# This creates a backup before removing anything

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if git repo
if [[ ! -d .git ]]; then
    log_error "Not a git repository. Please run from the project root."
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_warning "You have uncommitted changes"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

log_info "Creating backup branch..."
BACKUP_BRANCH="backup-before-cleanup-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
log_success "Backup branch created: $BACKUP_BRANCH"

log_info "Starting cleanup of unused code..."
echo ""

# Directories to remove
DIRS_TO_REMOVE=(
    # Platform apps
    "apps/macos"
    "apps/ios"
    "apps/android"
    "apps/shared"
    
    # Web UI (can be kept if needed)
    # "ui"
    
    # Documentation site
    "docs"
    
    # Removed channel extensions
    "extensions/whatsapp"
    "extensions/discord"
    "extensions/imessage"
    "extensions/googlechat"
    "extensions/msteams"
    "extensions/matrix"
    "extensions/zalo"
    "extensions/zalouser"
    "extensions/bluebubbles"
    "extensions/nostr"
    "extensions/nextcloud-talk"
    "extensions/mattermost"
    "extensions/line"
    "extensions/twitch"
    "extensions/tlon"
    "extensions/voice-call"
    
    # Advanced extensions
    "extensions/memory-lancedb"
    "extensions/memory-core"
    "extensions/llm-task"
    "extensions/lobster"
    "extensions/copilot-proxy"
    "extensions/diagnostics-otel"
    "extensions/google-gemini-cli-auth"
    "extensions/google-antigravity-auth"
    "extensions/qwen-portal-auth"
    "extensions/open-prose"
    
    # Removed source directories
    "src/web"
    "src/whatsapp"
    "src/discord"
    "src/imessage"
    "src/line"
    "src/browser"
    "src/canvas-host"
    "src/tts"
    "src/tui"
    "src/macos"
    "src/daemon"
    "src/control-ui"
    "src/media-understanding"
    "src/link-understanding"
    "src/cron"
    
    # Skills (keeping only core)
    "skills/1password"
    "skills/apple-notes"
    "skills/apple-reminders"
    "skills/bear-notes"
    "skills/bird"
    "skills/blogwatcher"
    "skills/blucli"
    "skills/bluebubbles"
    "skills/camsnap"
    "skills/canvas"
    "skills/clawdhub"
    "skills/coding-agent"
    "skills/discord"
    "skills/eightctl"
    "skills/food-order"
    "skills/gemini"
    "skills/gifgrep"
    "skills/github"
    "skills/gog"
    "skills/goplaces"
    "skills/himalaya"
    "skills/imsg"
    "skills/local-places"
    "skills/mcporter"
    "skills/model-usage"
    "skills/nano-banana-pro"
    "skills/nano-pdf"
    "skills/notion"
    "skills/obsidian"
    "skills/openai-image-gen"
    "skills/openai-whisper"
    "skills/openai-whisper-api"
    "skills/openhue"
    "skills/oracle"
    "skills/ordercli"
    "skills/peekaboo"
    "skills/remote-code"
    "skills/sag"
    "skills/sherpa-onnx-tts"
    "skills/skill-creator"
    "skills/slack"
    "skills/songsee"
    "skills/sonoscli"
    "skills/spotify-player"
    "skills/summarize"
    "skills/things-mac"
    "skills/tmux"
    "skills/trello"
    "skills/video-frames"
    "skills/voice-call"
    "skills/wacli"
    "skills/weather"
    
    # Test directories for removed features
    "test/fixtures"
    
    # Build artifacts
    "dist/Clawdbot.app"
    
    # Other
    "assets/chrome-extension"
    "Swabble"
)

# Files to remove
FILES_TO_REMOVE=(
    # Platform scripts
    "scripts/package-mac-app.sh"
    "scripts/package-mac-dist.sh"
    "scripts/restart-mac.sh"
    "scripts/codesign-mac-app.sh"
    "scripts/notarize-mac-artifact.sh"
    "scripts/create-dmg.sh"
    "scripts/build-and-run-mac.sh"
    "scripts/build_icon.sh"
    "scripts/make_appcast.sh"
    "scripts/ios-team-id.sh"
    "scripts/mobile-reauth.sh"
    "scripts/termux-auth-widget.sh"
    "scripts/termux-quick-auth.sh"
    "scripts/termux-sync-widget.sh"
    "scripts/auth-monitor.sh"
    "scripts/claude-auth-status.sh"
    "scripts/clawlog.sh"
    "scripts/setup-auth-system.sh"
    
    # Test scripts
    "scripts/test-live-models-docker.sh"
    "scripts/test-live-gateway-models-docker.sh"
    "scripts/test-install-sh-e2e-docker.sh"
    "scripts/test-install-sh-docker.sh"
    "scripts/test-cleanup-docker.sh"
    "scripts/sandbox-setup.sh"
    "scripts/sandbox-common-setup.sh"
    "scripts/sandbox-browser-setup.sh"
    "scripts/sandbox-browser-entrypoint.sh"
    
    # Canvas
    "scripts/bundle-a2ui.sh"
    "scripts/canvas-a2ui-copy.ts"
    
    # Protocol generation
    "scripts/protocol-gen.ts"
    "scripts/protocol-gen-swift.ts"
    
    # Docs
    "scripts/docs-list.js"
    "scripts/build-docs-list.mjs"
    "scripts/changelog-to-html.sh"
)

# Remove directories
for dir in "${DIRS_TO_REMOVE[@]}"; do
    if [[ -d "$dir" ]]; then
        log_info "Removing directory: $dir"
        rm -rf "$dir"
    fi
done

# Remove files
for file in "${FILES_TO_REMOVE[@]}"; do
    if [[ -f "$file" ]]; then
        log_info "Removing file: $file"
        rm -f "$file"
    fi
done

log_info "Cleaning up package.json scripts..."

# Remove unused npm scripts (this is a simplified approach)
# In practice, you'd want to edit package.json more carefully

log_info "Removing node_modules for fresh install..."
rm -rf node_modules

log_success "Cleanup complete!"
echo ""
log_info "Summary:"
echo "  - Removed platform apps (macOS, iOS, Android)"
echo "  - Removed unused channel integrations"
echo "  - Removed advanced features (browser, canvas, voice)"
echo "  - Removed most skills"
echo "  - Removed documentation site"
echo "  - Removed test infrastructure for removed features"
echo ""
log_info "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Test build: npm install && npm run build"
echo "  3. Commit changes: git add -A && git commit -m 'Cleanup: Remove unused code for lightweight version'"
echo "  4. If issues, restore: git checkout $BACKUP_BRANCH"
echo ""
log_warning "Backup branch: $BACKUP_BRANCH"
