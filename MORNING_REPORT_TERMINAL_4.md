# Morning report — Terminal 4

**Session:** 2026-04-22, 01:35 → ~02:25 ET
**Scope:** infra, deployment, writeup, repo hygiene, Loom script
**Branch:** `main` (committed locally, not pushed)

Eight phases shipped as eight commits, each with a short rationale line and
validated in the verification log. No blockers hit. `deploy/BLOCKERS.md`
does not exist.

## What's ready

- `README.md`, `.env.example`, `LICENSE`, root `.gitignore` extended for
  Node + frontend reference artifacts
- `deploy/setup_server.sh` — idempotent one-time CPX21 provisioner (Python 3.12,
  Node 20, Redis, nginx, certbot, uv, sqlite3, primer user, directory tree,
  systemd units, nginx site, ufw)
- `deploy/systemd/primer-backend.service` and `primer-frontend.service`
- `deploy/nginx/primer.conf` — reverse-proxies, `/briefing/*` has
  `proxy_buffering off` for SSE, certbot-ready
- `scripts/deploy.sh` — mirrors the Chariot deploy pattern, `DRY_RUN=1`
  supported, pre-flight refuses a dirty tree
- `deploy/writeup_draft.html` — Mode 4 writeup as self-contained HTML,
  ready for Terminal 3 to lift into the `<Writeup />` component
- `deploy/LOOM_SCRIPT.md` — 3-minute fallback demo script with click paths
- `.github/workflows/ci.yml` — four jobs: python / frontend / shellcheck / nginx
- `docs/ARCHITECTURE.md` + `docs/DECISIONS.md` — deeper-read companions
- `deploy/VERIFICATION_LOG.md` — every validation pass logged with timestamp

## What you need to do in the morning

Assuming Terminals 1–3 converge and the app runs end-to-end locally, the
path to a live HTTPS URL is:

### 1. Decide the domain

Pick the subdomain. The default placeholder is `primer.REPLACE_ME.com`; swap
across the repo with:

```bash
# from the repo root
grep -rl 'primer.REPLACE_ME.com' deploy/ | xargs sed -i '' \
  's/primer.REPLACE_ME.com/primer.<YOUR-DOMAIN>.com/g'
# also swap in the writeup's closing block:
sed -i '' 's|primer.REPLACE_ME.com|primer.<YOUR-DOMAIN>.com|g' deploy/writeup_draft.html
# and the Loom URL once you record it:
sed -i '' 's|loom.com/share/REPLACE_ME|<REAL-LOOM-URL>|g' deploy/writeup_draft.html
```

Commit the swap as a one-liner.

### 2. Provision the box

Either reuse `5.161.116.216` (if you want Primer at a subdomain of
Chariot's host) or spin up a fresh CPX21 at `console.hetzner.cloud`.

```bash
# Once the box exists and DNS for primer.<YOUR-DOMAIN> points at it:
scp deploy/setup_server.sh root@<IP>:/root/setup_server.sh
ssh root@<IP> "PRIMER_DOMAIN=primer.<YOUR-DOMAIN>.com \
                bash /root/setup_server.sh"
```

Wait ~5 min. The script logs each step. At the end it prints the certbot +
`.env` next-steps.

### 3. Fill in `.env` on the server

```bash
ssh root@<IP>
vim /opt/primer/app/.env                   # paste real ANTHROPIC_API_KEY
systemctl start primer-backend primer-frontend
```

### 4. Provision SSL

```bash
ssh root@<IP> "certbot --nginx -d primer.<YOUR-DOMAIN>.com \
               --non-interactive --agree-tos -m <YOUR-EMAIL>"
```

certbot will add `listen 443 ssl`, the cert paths, and convert the `listen 80`
block into an HTTPS redirect in place. Verify with:

```bash
curl -I https://primer.<YOUR-DOMAIN>.com/api/accounts
```

### 5. Future deploys

From your laptop, every subsequent push:

```bash
PRIMER_SERVER=root@<IP> \
PRIMER_DOMAIN=primer.<YOUR-DOMAIN>.com \
scripts/deploy.sh
```

Or dry-run first:

```bash
DRY_RUN=1 PRIMER_SERVER=root@<IP> scripts/deploy.sh
```

## What the writeup looks like

`deploy/writeup_draft.html` is a self-contained HTML document you can open
directly in a browser. It's laid out as a scrollable editorial — Fraunces
headlines, Inter Tight body, JetBrains Mono kickers — matching the frontend
design tokens in `specs/05_FRONTEND_SPEC.md`. Ten sections: a hero with
build-time framing ("about six hours, four Claude Code terminals"), eight
claim-as-header slides (read-layer thesis, opinionated brief, det/prob UI,
validation as architecture, intentional exclusions, Account Intelligence
layer with 30/60/90 timeline, AI-in-the-build with a four-terminals visual,
tradeoffs grid), and a closing card with prototype / GitHub / Loom /
contact links. Each slide has collapsible speaker notes holding 200-400
words of deeper V1 prose so a hiring manager can skim the claims and
expand the sections they want to dig into.

Terminal 3 will port this into the `<Writeup />` React component. The
self-contained form lets you preview the draft immediately and tune the
content/tone in the morning before Terminal 3 integrates it.

Two things you probably want to adjust before porting:

1. **Build-time number.** Current draft says "about six hours" — bump it to
   whatever the final elapsed wall-clock was when all four terminals
   converged.
2. **Loom URL + domain.** The closing block has `REPLACE_ME` placeholders.

## Blockers

None. Every validation passed:

| Phase | What | Result |
| --- | --- | --- |
| 2 | `setup_server.sh` | shellcheck 0.11.0 clean |
| 2 | systemd units | `systemd-analyze verify` — no syntax errors |
| 3 | `nginx/primer.conf` | `nginx -t` in `nginx:alpine`, both pre-cert and simulated post-certbot |
| 4 | `scripts/deploy.sh` | shellcheck clean; `DRY_RUN=1` walked through |
| 5 | `writeup_draft.html` | HTML tag-balance check: 0 errors |
| 7 | `ci.yml` | YAML parses, 4 jobs defined |

Full log: `deploy/VERIFICATION_LOG.md`.

## Links

- Loom script: [`deploy/LOOM_SCRIPT.md`](deploy/LOOM_SCRIPT.md)
- Writeup preview: open `deploy/writeup_draft.html` in your browser
- Verification log: [`deploy/VERIFICATION_LOG.md`](deploy/VERIFICATION_LOG.md)
- Architecture doc: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Decisions doc: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Last note

None of this touches `backend/`, `frontend/`, or `mcp_servers/` — those
are Terminals 1–3's work, and I kept the commit surface strictly within
`deploy/`, `docs/`, `scripts/`, `.github/`, and root-level files. Staging
was manual (`git add <explicit files>`) so concurrent terminal work
wouldn't collide at commit time. When you converge in the morning, a
`git log` on `main` will show an interleaved but conflict-free sequence
of commits from all four terminals.
