#!/usr/bin/env bash
# Swar Mangal — aaPanel VPS setup script.
#
# Run this ONCE on a fresh aaPanel Ubuntu/Debian VPS after aaPanel is installed.
# It installs Node.js 22, clones the repo, builds, and starts the PM2 processes.
#
# Prerequisites:
#   - aaPanel installed (https://www.aapanel.com)
#   - Git installed (aaPanel panel → App Store → Git)
#   - PostgreSQL created via aaPanel → Databases → Add Database
#
# Usage:
#   ssh root@<vps-ip>
#   cd /opt/swarmangal/deploy/aapanel
#   chmod +x setup.sh && ./setup.sh
set -euo pipefail

APP_DIR="/opt/swarmangal"
LOG_DIR="/var/log/swarmangal"

echo "=== Swar Mangal aaPanel setup ==="

# --- 1. System packages ---
echo "[1/7] Installing system packages..."
apt-get update -qq
apt-get install -y -qq curl git build-essential

# --- 2. Node.js 22 via NodeSource ---
echo "[2/7] Installing Node.js 22..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  node $(node -v)  npm $(npm -v)"

# --- 3. PM2 ---
echo "[3/7] Installing PM2 globally..."
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# --- 4. Clone repo ---
echo "[4/7] Cloning repo..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  Repo exists, pulling..."
  cd "$APP_DIR" && git pull --ff-only
else
  git clone https://github.com/swarmangal7-code/Swar-Mangal.git "$APP_DIR"
  cd "$APP_DIR"
fi

# --- 5. Install & build ---
echo "[5/7] Installing dependencies and building..."
npm ci
npm run build

# --- 6. Environment file ---
echo "[6/7] Setting up environment..."
mkdir -p "$LOG_DIR"
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/deploy/.env.example" "$APP_DIR/.env"
  echo ""
  echo "  *** Edit $APP_DIR/.env with your actual values ***"
  echo "  Required: DATABASE_URL, RPC_FOUNDER_TOKEN, RPC_STAFF_TOKEN,"
  echo "            RPC_STAFF_BRANCHES, APP_DOMAIN, SESSION_SECRET"
  echo ""
fi

# --- 7. Start PM2 ---
echo "[7/7] Starting PM2 processes..."
pm2 start deploy/aapanel/ecosystem.config.cjs
pm2 save

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit $APP_DIR/.env with your real values"
echo "  2. In aaPanel → Databases: create DB 'swarmangal' (name it anything, then match it in DATABASE_URL)"
echo "  3. In aaPanel → Website: add your domain, set Nginx config from deploy/aapanel/nginx.conf"
echo "  4. Enable SSL in aaPanel → Website → your domain → SSL → Let's Encrypt"
echo "  5. pm2 restart swarmangal-app"
echo "  6. Test: curl -s -X POST https://your-domain/api/rpc -d 'function=api_dashboard&token=wrong'"
echo "     -> should return {\"ok\":false,\"code\":\"AUTH_FAILED\",...}"
echo ""
echo "Optional (WhatsApp):"
echo "  docker compose -f deploy/docker-compose.yml up -d wa-db wa-akg"
echo ""
echo "Nightly backup cron:"
echo "  15 2 * * * $APP_DIR/deploy/aapanel/backup.sh >> $LOG_DIR/backup.log 2>&1"
echo ""
echo "Daily fees digest cron:"
echo "  0 9 * * * curl -s -X POST https://your-domain/api/rpc -d function=api_founder_sendDailyDigest -d token=\$RPC_FOUNDER_TOKEN >/dev/null"
