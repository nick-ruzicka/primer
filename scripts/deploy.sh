#!/usr/bin/env bash
# Primer — deploy script. Mirrors the Chariot Signal Engine pattern:
# push to the remote, SSH to the server, fast-forward, rebuild, restart.
#
# Usage:
#   scripts/deploy.sh                                 # default server, main
#   PRIMER_SERVER=root@1.2.3.4 scripts/deploy.sh      # override host
#   BRANCH=feature/x scripts/deploy.sh                # override branch
#   DRY_RUN=1 scripts/deploy.sh                       # print without executing
#
# Exit codes:
#   0  deploy finished successfully
#   1  pre-flight failure on the local side
#   2  deploy failed on the remote side

set -euo pipefail

# ---- Config ----
PRIMER_SERVER="${PRIMER_SERVER:-root@5.161.116.241}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/primer/app}"
DRY_RUN="${DRY_RUN:-0}"

# ---- Pretty ----
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }
info()   { printf '\033[1;34m→\033[0m %s\n' "$*"; }
warn()   { printf '\033[1;33m!\033[0m %s\n' "$*"; }
ok()     { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die()    { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---- Dry-run helpers ----
run_local() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '  [dry-run local] %s\n' "$*"
  else
    eval "$*"
  fi
}

run_remote() {
  local cmd="$*"
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '  [dry-run ssh] %s\n' "${cmd}"
  else
    ssh -o StrictHostKeyChecking=accept-new "${PRIMER_SERVER}" "${cmd}"
  fi
}

# ---- Pre-flight (local) ----
bold "Primer deploy — ${PRIMER_SERVER} (branch ${BRANCH})"

if [[ "${DRY_RUN}" != "1" ]]; then
  command -v git >/dev/null || die "git not found on PATH"
  command -v ssh >/dev/null || die "ssh not found on PATH"

  # Refuse to deploy a dirty tree unless forced.
  if [[ -n "$(git status --porcelain)" ]]; then
    warn "Working tree is dirty. Commit or stash before deploying."
    git status --short
    die "refusing to deploy with uncommitted changes"
  fi
fi

# ---- Push latest ----
info "Pushing origin/${BRANCH}"
run_local "git push origin ${BRANCH}"

# ---- Remote deploy ----
info "Deploying to ${PRIMER_SERVER}:${APP_DIR}"

# Note on quoting: we build the remote command string here and ship it over
# ssh. Values interpolated at this point are locked in; the remote shell
# only sees the final string.
REMOTE_SCRIPT=$(cat <<REMOTE
set -euo pipefail

cd ${APP_DIR}

echo "  → fetching origin"
sudo -u primer git fetch origin --prune
sudo -u primer git reset --hard origin/${BRANCH}

echo "  → syncing python deps"
sudo -u primer /usr/local/bin/uv sync --frozen

echo "  → reseeding SQLite DB"
sudo -u primer /usr/local/bin/uv run python data/seed.py

echo "  → installing + building frontend"
sudo -u primer bash -c "cd ${APP_DIR}/frontend && npm ci && npm run build"

echo "  → installing systemd units (in case they changed)"
sudo install -m 0644 ${APP_DIR}/deploy/systemd/primer-backend.service  /etc/systemd/system/primer-backend.service
sudo install -m 0644 ${APP_DIR}/deploy/systemd/primer-frontend.service /etc/systemd/system/primer-frontend.service
sudo systemctl daemon-reload

echo "  → restarting services"
sudo systemctl restart primer-backend
sudo systemctl restart primer-frontend
sudo systemctl reload nginx

echo "  → waiting for backend /health"
for i in \$(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "  ✓ backend healthy after \${i}s"
    break
  fi
  if [ "\${i}" = "30" ]; then
    echo "  ✗ backend did not become healthy within 30s" >&2
    sudo journalctl -u primer-backend -n 50 --no-pager >&2 || true
    exit 2
  fi
  sleep 1
done

echo "  → waiting for frontend :3000"
for i in \$(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "  ✓ frontend healthy after \${i}s"
    break
  fi
  if [ "\${i}" = "30" ]; then
    echo "  ✗ frontend did not become healthy within 30s" >&2
    sudo journalctl -u primer-frontend -n 50 --no-pager >&2 || true
    exit 2
  fi
  sleep 1
done

echo "  → service status"
sudo systemctl is-active primer-backend  || true
sudo systemctl is-active primer-frontend || true

echo "Deploy complete at \$(date -u +%FT%TZ)"
REMOTE
)

run_remote "bash -c $(printf '%q' "${REMOTE_SCRIPT}")"

# ---- Post-deploy smoke test ----
if [[ "${DRY_RUN}" != "1" ]]; then
  info "Smoke-testing /api/accounts"
  if command -v curl >/dev/null; then
    # Only tries against PRIMER_DOMAIN if the operator set it; otherwise skip.
    if [[ -n "${PRIMER_DOMAIN:-}" ]]; then
      if curl -fsS --max-time 10 "https://${PRIMER_DOMAIN}/api/accounts" >/dev/null; then
        ok "accounts endpoint responded"
      else
        warn "could not reach https://${PRIMER_DOMAIN}/api/accounts"
      fi
    else
      warn "PRIMER_DOMAIN not set — skipping HTTP smoke test"
    fi
  fi
fi

ok "Done."
