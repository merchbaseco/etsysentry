#!/usr/bin/env bash
# Idempotent EtsySentry cloud agent install, the repo-owned part of the fleet
# cloud agent contract (zknicker/agents cloud-agent-setup skill). Cursor runs it
# as its snapshot install; Claude runs it from the fleet start each session.
# Installs the system toolchain (PostgreSQL + Bun) if missing, then installs
# workspace dependencies. There is no .env step: the committed .env.schema is
# the environment contract and values resolve from 1Password through the
# fleet-wide Development identity each platform provides as
# CLOUD_AGENTS_DEVELOPMENT_OP_TOKEN.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Pinned so `bunx varlock` behaves identically before node_modules exists.
VARLOCK_VERSION="1.16.1"

# Use sudo only when not already root (build pods may run as root).
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

# --- System dependency: PostgreSQL (native; Docker is unavailable in the VM) ---
# apt fetches occasionally return transient proxy errors in build pods, so both
# the apt-level fetch and the whole step retry.
if ! command -v psql >/dev/null 2>&1; then
    echo "[install] Installing PostgreSQL..."
    install_postgres() {
        $SUDO apt-get update -y -o Acquire::Retries=5
        $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
            -o Acquire::Retries=5 --fix-missing \
            postgresql postgresql-contrib
    }
    pg_installed=0
    for attempt in 1 2 3; do
        if install_postgres; then
            pg_installed=1
            break
        fi
        echo "[install] apt attempt ${attempt} failed; retrying in 5s..." >&2
        sleep 5
    done
    if [ "$pg_installed" -ne 1 ]; then
        echo "[install] ERROR: PostgreSQL installation failed after retries." >&2
        exit 1
    fi
else
    echo "[install] PostgreSQL already present."
fi

# The schema's development arm uses port 5435, which is also where Compose
# publishes Postgres. Match it here so the contract needs no per-venue override
# beyond the host.
PG_CONF="$(ls /etc/postgresql/*/main/postgresql.conf 2>/dev/null | head -1 || true)"
if [ -n "$PG_CONF" ]; then
    $SUDO sed -i "s/^#\?port *=.*/port = 5435/" "$PG_CONF"
    echo "[install] PostgreSQL configured to listen on 5435."
fi

# --- System dependency: Bun (pinned by package.json packageManager) ---
# Cloud images can already carry another repository's Bun, so the pinned
# version is installed whenever the active one differs, not only when missing.
BUN_VERSION="$(sed -n 's/.*"packageManager": *"bun@\([^"]*\)".*/\1/p' package.json)"
if [ -z "$BUN_VERSION" ]; then
    echo "[install] ERROR: package.json does not pin packageManager bun@<version>." >&2
    exit 1
fi
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
if [ "$(bun --version 2>/dev/null || true)" != "$BUN_VERSION" ]; then
    echo "[install] Installing Bun ${BUN_VERSION}..."
    curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
    if ! grep -q 'BUN_INSTALL' "$HOME/.bashrc" 2>/dev/null; then
        printf '\nexport BUN_INSTALL="$HOME/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n' >>"$HOME/.bashrc"
    fi
else
    echo "[install] Bun ${BUN_VERSION} already present."
fi
# Shells that never read .bashrc (hooks, terminals) resolve bun from PATH, where
# another install may sit first; point the shared locations at the pinned one.
$SUDO ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun
$SUDO ln -sf "$BUN_INSTALL/bin/bunx" /usr/local/bin/bunx
if [ "$(bun --version)" != "$BUN_VERSION" ]; then
    echo "[install] ERROR: bun reports $(bun --version), expected ${BUN_VERSION}." >&2
    exit 1
fi

# --- Install-time credential ---
# The private @merchbaseco/* scope needs a GitHub Packages read token. It is an
# @internal schema item, so `varlock run` deliberately does not export it; it is
# fetched explicitly under the install switch, resolved from the Development
# vault via CLOUD_AGENTS_DEVELOPMENT_OP_TOKEN.
if [ -z "${MERCHBASE_GITHUB_NPM_TOKEN:-}" ]; then
    echo "[install] Resolving the GitHub Packages read token from 1Password..."
    MERCHBASE_GITHUB_NPM_TOKEN="$(
        ETSYSENTRY_RESOLVE_INSTALL_TOKENS=true \
            bunx "varlock@${VARLOCK_VERSION}" printenv MERCHBASE_GITHUB_NPM_TOKEN
    )"
    export MERCHBASE_GITHUB_NPM_TOKEN
fi
if [ -z "${MERCHBASE_GITHUB_NPM_TOKEN:-}" ]; then
    echo "[install] ERROR: MERCHBASE_GITHUB_NPM_TOKEN did not resolve; the private" \
        "@merchbaseco/access package cannot be installed." >&2
    exit 1
fi

timeout 900 bun install --frozen-lockfile || { echo "[install] ERROR: bun install failed or timed out" >&2; exit 1; }

echo "[install] Done."
