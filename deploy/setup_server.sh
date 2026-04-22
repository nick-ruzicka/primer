#!/usr/bin/env bash
# Primer — one-time Hetzner CPX21 provisioner.
#
# Run as root on a fresh Ubuntu 24.04 LTS box:
#   scp deploy/setup_server.sh root@<IP>:/root/setup_server.sh
#   ssh root@<IP> PRIMER_DOMAIN=primer.example.com bash /root/setup_server.sh
#
# Idempotent: safe to re-run. Package installs skip what's already there,
# directory + user creation is guarded.

set -euo pipefail

# ---- Config (env-overridable) ----
PRIMER_USER="${PRIMER_USER:-primer}"
PRIMER_HOME="${PRIMER_HOME:-/opt/primer}"
PRIMER_REPO="${PRIMER_REPO:-https://github.com/nick-ruzicka/primer-attentive.git}"
PRIMER_BRANCH="${PRIMER_BRANCH:-main}"
PRIMER_DOMAIN="${PRIMER_DOMAIN:-primer.REPLACE_ME.com}"
NODE_MAJOR="${NODE_MAJOR:-20}"

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "setup_server.sh must run as root." >&2
  exit 1
fi

log "Updating apt and installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl ca-certificates gnupg lsb-release \
  git build-essential \
  python3.12 python3.12-venv python3-pip \
  redis-server \
  nginx \
  certbot python3-certbot-nginx \
  sqlite3 \
  ufw

log "Installing Node ${NODE_MAJOR}.x from NodeSource"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v${NODE_MAJOR}* ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

log "Installing uv (astral.sh) system-wide"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh
fi
uv --version

log "Creating ${PRIMER_USER} user and ${PRIMER_HOME} tree"
if ! id -u "${PRIMER_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${PRIMER_USER}" --shell /bin/bash "${PRIMER_USER}"
fi

mkdir -p "${PRIMER_HOME}" "${PRIMER_HOME}/logs" "${PRIMER_HOME}/app"
chown -R "${PRIMER_USER}:${PRIMER_USER}" "${PRIMER_HOME}"

log "Cloning (or updating) the repo at ${PRIMER_HOME}/app"
if [[ ! -d "${PRIMER_HOME}/app/.git" ]]; then
  sudo -u "${PRIMER_USER}" git clone --branch "${PRIMER_BRANCH}" "${PRIMER_REPO}" "${PRIMER_HOME}/app"
else
  sudo -u "${PRIMER_USER}" git -C "${PRIMER_HOME}/app" fetch origin
  sudo -u "${PRIMER_USER}" git -C "${PRIMER_HOME}/app" checkout "${PRIMER_BRANCH}"
  sudo -u "${PRIMER_USER}" git -C "${PRIMER_HOME}/app" pull --ff-only origin "${PRIMER_BRANCH}"
fi

log "Bootstrapping Python venv via uv"
sudo -u "${PRIMER_USER}" bash -c "cd ${PRIMER_HOME}/app && uv sync --frozen"
if [[ ! -e "${PRIMER_HOME}/venv" ]]; then
  ln -s "${PRIMER_HOME}/app/.venv" "${PRIMER_HOME}/venv"
fi

log "Seeding the SQLite database"
sudo -u "${PRIMER_USER}" bash -c "cd ${PRIMER_HOME}/app && uv run python data/seed.py"

log "Installing frontend dependencies and building"
sudo -u "${PRIMER_USER}" bash -c "cd ${PRIMER_HOME}/app/frontend && npm ci && npm run build"

log "Creating .env template if missing"
if [[ ! -f "${PRIMER_HOME}/app/.env" ]]; then
  cp "${PRIMER_HOME}/app/.env.example" "${PRIMER_HOME}/app/.env"
  chown "${PRIMER_USER}:${PRIMER_USER}" "${PRIMER_HOME}/app/.env"
  chmod 600 "${PRIMER_HOME}/app/.env"
  echo "Created ${PRIMER_HOME}/app/.env from .env.example — fill in ANTHROPIC_API_KEY before starting services."
fi

log "Installing systemd units"
install -m 0644 "${PRIMER_HOME}/app/deploy/systemd/primer-backend.service" /etc/systemd/system/primer-backend.service
install -m 0644 "${PRIMER_HOME}/app/deploy/systemd/primer-frontend.service" /etc/systemd/system/primer-frontend.service
systemctl daemon-reload

log "Installing nginx site (domain=${PRIMER_DOMAIN})"
# Swap the placeholder domain in the shipped conf.
NGINX_SITE_SRC="${PRIMER_HOME}/app/deploy/nginx/primer.conf"
NGINX_SITE_DST="/etc/nginx/sites-available/primer"
sed "s/primer\.REPLACE_ME\.com/${PRIMER_DOMAIN}/g" "${NGINX_SITE_SRC}" > "${NGINX_SITE_DST}"
ln -sf "${NGINX_SITE_DST}" /etc/nginx/sites-enabled/primer
rm -f /etc/nginx/sites-enabled/default

log "Validating nginx config"
nginx -t

log "Enabling services"
systemctl enable --now redis-server
systemctl enable primer-backend primer-frontend
# Start only if .env has a real API key. Otherwise leave stopped and warn.
if grep -q '^ANTHROPIC_API_KEY=sk-ant-\.\.\.' "${PRIMER_HOME}/app/.env" 2>/dev/null; then
  echo "ANTHROPIC_API_KEY is still the placeholder. Leaving primer-backend / primer-frontend stopped."
  echo "Edit ${PRIMER_HOME}/app/.env, then: systemctl start primer-backend primer-frontend"
else
  systemctl start primer-backend primer-frontend
fi
systemctl reload nginx

log "Firewall (ufw) allowlist"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

cat <<EOF

============================================================
Primer server bootstrap complete.

Next steps (run manually — these need DNS + domain to exist):

  1. Point an A record for ${PRIMER_DOMAIN} at this box's public IP.
  2. Wait 5–10 minutes for propagation, then run certbot:
       certbot --nginx -d ${PRIMER_DOMAIN} --non-interactive --agree-tos -m you@example.com
  3. Fill in ${PRIMER_HOME}/app/.env with the real ANTHROPIC_API_KEY, then:
       systemctl restart primer-backend primer-frontend

Service status:
  systemctl status primer-backend
  systemctl status primer-frontend
  tail -f ${PRIMER_HOME}/logs/backend.log
  tail -f ${PRIMER_HOME}/logs/frontend.log

Redeploy later from your laptop:
  PRIMER_SERVER=root@<this-ip> scripts/deploy.sh

============================================================
EOF
