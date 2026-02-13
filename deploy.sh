#!/usr/bin/env bash
set -euo pipefail

# Lightweight Clawdbot Deployment Script
# Supports Signal, Telegram, and Slack channels

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GATEWAY_PORT="${GATEWAY_PORT:-18789}"
SERVICE_TYPE="${SERVICE_TYPE:-auto}"
CLAWDBOT_HOME="${CLAWDBOT_HOME:-$HOME/.clawdbot}"
NODE_MIN_VERSION="22"

# Functions
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

check_command() {
    if ! command -v "$1" &> /dev/null; then
        return 1
    fi
    return 0
}

check_node_version() {
    if ! check_command node; then
        log_error "Node.js is not installed"
        log_info "Please install Node.js >= ${NODE_MIN_VERSION}"
        exit 1
    fi

    local node_version
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [[ "$node_version" -lt "$NODE_MIN_VERSION" ]]; then
        log_error "Node.js version $node_version is too old"
        log_info "Please upgrade to Node.js >= ${NODE_MIN_VERSION}"
        exit 1
    fi
    
    log_success "Node.js version check passed (v$node_version)"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    check_node_version
    
    if ! check_command npm && ! check_command pnpm && ! check_command bun; then
        log_error "No package manager found (npm, pnpm, or bun)"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

install_packages() {
    log_info "Installing packages..."
    
    if check_command pnpm; then
        pnpm install --prod
    elif check_command bun; then
        bun install --production
    else
        npm install --production
    fi
    
    log_success "Packages installed"
}

build_project() {
    log_info "Building project..."
    
    if check_command pnpm; then
        pnpm build
    elif check_command bun; then
        bun run build
    else
        npm run build
    fi
    
    log_success "Project built"
}

setup_config() {
    log_info "Setting up configuration..."
    
    mkdir -p "$CLAWDBOT_HOME"
    mkdir -p "$CLAWDBOT_HOME/logs"
    mkdir -p "$CLAWDBOT_HOME/sessions"
    mkdir -p "$CLAWDBOT_HOME/credentials"
    
    local config_file="$CLAWDBOT_HOME/clawdbot.json"
    
    if [[ ! -f "$config_file" ]]; then
        log_info "Creating default configuration..."
        cat > "$config_file" << 'EOF'
{
  "agent": {
    "model": "anthropic/claude-opus-4-5"
  },
  "channels": {
    "telegram": {
      "enabled": false
    },
    "slack": {
      "enabled": false
    },
    "signal": {
      "enabled": false
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789
  }
}
EOF
        log_warning "Default configuration created at $config_file"
        log_warning "Please edit this file with your channel tokens"
    else
        log_success "Configuration already exists at $config_file"
    fi
}

check_env_vars() {
    log_info "Checking environment variables..."
    
    local missing_vars=()
    
    # Check AI provider
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]] && [[ -z "${OPENAI_API_KEY:-}" ]]; then
        missing_vars+=("ANTHROPIC_API_KEY or OPENAI_API_KEY")
    fi
    
    # Check channel tokens (at least one should be configured)
    local has_channel=false
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
        has_channel=true
    fi
    if [[ -n "${SLACK_BOT_TOKEN:-}" ]] && [[ -n "${SLACK_APP_TOKEN:-}" ]]; then
        has_channel=true
    fi
    if [[ -n "${SIGNAL_ACCOUNT:-}" ]]; then
        has_channel=true
    fi
    
    if [[ "$has_channel" == false ]]; then
        log_warning "No channel tokens found in environment"
        log_warning "Please set at least one of: TELEGRAM_BOT_TOKEN, SLACK_BOT_TOKEN+SLACK_APP_TOKEN, or SIGNAL_ACCOUNT"
    fi
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        log_info "Set these in your environment or in $CLAWDBOT_HOME/.env"
        exit 1
    fi
    
    log_success "Environment variables check passed"
}

check_port() {
    log_info "Checking if port $GATEWAY_PORT is available..."
    
    if command -v lsof &> /dev/null; then
        if lsof -Pi :$GATEWAY_PORT -sTCP:LISTEN -t &> /dev/null; then
            log_error "Port $GATEWAY_PORT is already in use"
            log_info "Stop the existing service or choose a different port with GATEWAY_PORT=<port>"
            exit 1
        fi
    elif command -v ss &> /dev/null; then
        if ss -ltn | grep -q ":$GATEWAY_PORT "; then
            log_error "Port $GATEWAY_PORT is already in use"
            exit 1
        fi
    fi
    
    log_success "Port $GATEWAY_PORT is available"
}

detect_service_manager() {
    if [[ "$SERVICE_TYPE" != "auto" ]]; then
        echo "$SERVICE_TYPE"
        return
    fi
    
    if check_command systemctl && [[ -d /etc/systemd/system ]]; then
        echo "systemd"
    elif check_command pm2; then
        echo "pm2"
    else
        echo "manual"
    fi
}

setup_systemd() {
    log_info "Setting up systemd service..."
    
    local service_file="/etc/systemd/system/clawdbot-gateway.service"
    local user=$(whoami)
    
    if [[ ! -w /etc/systemd/system ]]; then
        log_error "Cannot write to /etc/systemd/system"
        log_info "Please run with sudo or use --service pm2"
        exit 1
    fi
    
    cat > "$service_file" << EOF
[Unit]
Description=Clawdbot Gateway
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$SCRIPT_DIR
Environment="NODE_ENV=production"
Environment="GATEWAY_PORT=$GATEWAY_PORT"
ExecStart=$(which node) dist/entry.js gateway run --port $GATEWAY_PORT
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable clawdbot-gateway
    systemctl start clawdbot-gateway
    
    log_success "Systemd service installed and started"
    log_info "Manage with: systemctl {start|stop|restart|status} clawdbot-gateway"
    log_info "View logs with: journalctl -u clawdbot-gateway -f"
}

setup_pm2() {
    log_info "Setting up PM2 service..."
    
    if ! check_command pm2; then
        log_info "Installing PM2..."
        npm install -g pm2
    fi
    
    pm2 delete clawdbot-gateway 2>/dev/null || true
    
    pm2 start dist/entry.js \
        --name clawdbot-gateway \
        --interpreter node \
        -- gateway run --port "$GATEWAY_PORT"
    
    pm2 save
    pm2 startup || log_warning "Could not setup PM2 startup script (may need sudo)"
    
    log_success "PM2 service started"
    log_info "Manage with: pm2 {start|stop|restart|logs} clawdbot-gateway"
}

start_manual() {
    log_info "Starting gateway manually..."
    log_warning "This will run in the foreground. Press Ctrl+C to stop."
    log_info "For background service, use --service systemd or --service pm2"
    
    node dist/entry.js gateway run --port "$GATEWAY_PORT"
}

health_check() {
    log_info "Running health check..."
    
    local max_attempts=10
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -sf "http://localhost:$GATEWAY_PORT/health" &> /dev/null; then
            log_success "Gateway is healthy"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 2
    done
    
    log_error "Gateway health check failed after $max_attempts attempts"
    return 1
}

show_status() {
    log_info "Gateway Status:"
    echo ""
    
    local service_manager
    service_manager=$(detect_service_manager)
    
    case "$service_manager" in
        systemd)
            systemctl status clawdbot-gateway --no-pager || true
            ;;
        pm2)
            pm2 status clawdbot-gateway || true
            ;;
        *)
            log_info "No service manager detected"
            ;;
    esac
    
    echo ""
    log_info "Gateway URL: http://localhost:$GATEWAY_PORT"
    
    if curl -sf "http://localhost:$GATEWAY_PORT/health" &> /dev/null; then
        log_success "Gateway is running and healthy"
    else
        log_warning "Gateway is not responding"
    fi
}

stop_service() {
    log_info "Stopping gateway..."
    
    local service_manager
    service_manager=$(detect_service_manager)
    
    case "$service_manager" in
        systemd)
            systemctl stop clawdbot-gateway
            log_success "Systemd service stopped"
            ;;
        pm2)
            pm2 stop clawdbot-gateway
            log_success "PM2 service stopped"
            ;;
        *)
            log_warning "No service manager detected"
            log_info "Kill manually with: pkill -f clawdbot-gateway"
            ;;
    esac
}

restart_service() {
    log_info "Restarting gateway..."
    
    local service_manager
    service_manager=$(detect_service_manager)
    
    case "$service_manager" in
        systemd)
            systemctl restart clawdbot-gateway
            log_success "Systemd service restarted"
            ;;
        pm2)
            pm2 restart clawdbot-gateway
            log_success "PM2 service restarted"
            ;;
        *)
            log_error "No service manager detected"
            exit 1
            ;;
    esac
    
    sleep 2
    health_check
}

show_usage() {
    cat << EOF
Lightweight Clawdbot Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    --help              Show this help message
    --service TYPE      Service manager: systemd, pm2, manual (default: auto)
    --port PORT         Gateway port (default: 18789)
    --status            Show gateway status
    --stop              Stop the gateway
    --restart           Restart the gateway
    --skip-build        Skip build step
    --skip-install      Skip package installation

ENVIRONMENT VARIABLES:
    GATEWAY_PORT        Gateway port (default: 18789)
    SERVICE_TYPE        Service manager type
    CLAWDBOT_HOME       Config directory (default: ~/.clawdbot)

EXAMPLES:
    # Full deployment with systemd
    $0 --service systemd

    # Deploy with PM2
    $0 --service pm2

    # Manual start (foreground)
    $0 --service manual

    # Check status
    $0 --status

    # Restart
    $0 --restart

EOF
}

# Main
main() {
    local skip_build=false
    local skip_install=false
    local action="deploy"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help)
                show_usage
                exit 0
                ;;
            --service)
                SERVICE_TYPE="$2"
                shift 2
                ;;
            --port)
                GATEWAY_PORT="$2"
                shift 2
                ;;
            --status)
                action="status"
                shift
                ;;
            --stop)
                action="stop"
                shift
                ;;
            --restart)
                action="restart"
                shift
                ;;
            --skip-build)
                skip_build=true
                shift
                ;;
            --skip-install)
                skip_install=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Handle actions
    case "$action" in
        status)
            show_status
            exit 0
            ;;
        stop)
            stop_service
            exit 0
            ;;
        restart)
            restart_service
            exit 0
            ;;
    esac
    
    # Deploy
    log_info "Starting deployment..."
    echo ""
    
    check_dependencies
    
    if [[ "$skip_install" == false ]]; then
        install_packages
    fi
    
    if [[ "$skip_build" == false ]]; then
        build_project
    fi
    
    setup_config
    check_env_vars
    check_port
    
    local service_manager
    service_manager=$(detect_service_manager)
    
    log_info "Using service manager: $service_manager"
    
    case "$service_manager" in
        systemd)
            setup_systemd
            sleep 2
            health_check
            ;;
        pm2)
            setup_pm2
            sleep 2
            health_check
            ;;
        manual)
            start_manual
            ;;
        *)
            log_error "Unknown service manager: $service_manager"
            exit 1
            ;;
    esac
    
    echo ""
    log_success "Deployment complete!"
    echo ""
    log_info "Gateway running on http://localhost:$GATEWAY_PORT"
    log_info "Configuration: $CLAWDBOT_HOME/clawdbot.json"
    log_info "Logs: $CLAWDBOT_HOME/logs/"
    echo ""
}

main "$@"
