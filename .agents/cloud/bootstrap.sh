#!/usr/bin/env bash
# Fleet-owned cloud agent bootstrap from zknicker/agents cloud/bootstrap.sh.
# Product repos keep an exact copy at .agents/cloud/bootstrap.sh; edit it in
# zknicker/agents, not in a product repo.
#
# Usage: bootstrap.sh <claude|cursor>
# Runs this repo's .agents/cloud scripts: env.sh (sourced), install.sh (Claude
# only; Cursor runs it as its snapshot step), and start.sh. Claude sessions
# get the fleet from the environment Setup script's session hook
# (cloud/setup-script.sh), which runs alongside this one. Cursor has no such
# hook, so this first downloads the fleet into ~/.agents/fleet and seeds
# Cursor; the read key resolves from 1Password with the
# CLOUD_AGENTS_DEVELOPMENT_OP_TOKEN every cloud platform provides.
# CLOUD_AGENTS_FLEET_REF selects a fleet branch to trial; it defaults to main.
# Logs go to stderr; for Claude, stdout carries the SessionStart hook JSON.
set -euo pipefail

platform="${1:?Usage: bootstrap.sh <claude|cursor>}"
root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cloud="$root/.agents/cloud"
fleet="$HOME/.agents/fleet"
# Platform start hooks can run without a login shell; expose the usual
# user-level toolchain locations.
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"

log() {
  printf '[cloud-agent] %s\n' "$1" >&2
}

download_fleet() {
  local scratch read_token
  scratch="$(mktemp -d)"
  mkdir -p "$scratch/schema"
  cat > "$scratch/schema/.env.schema" <<'EOF'
# @plugin(@varlock/1password-plugin@2.0.3)
# @initOp(id=development, token=$CLOUD_AGENTS_DEVELOPMENT_OP_TOKEN, allowAppAuth=false, account=knickerbockerventures.1password.com)
# @defaultSensitive=true @defaultRequired=true
# ---
# @type=opServiceAccountToken @sensitive @internal
CLOUD_AGENTS_DEVELOPMENT_OP_TOKEN=
# @sensitive @internal
FLEET_GITHUB_READ_TOKEN=op(development, "op://Development/GitHub Repo Read - Fleet Agents/credential")
EOF
  read_token="$(cd "$root" && bunx varlock@1.16.1 printenv FLEET_GITHUB_READ_TOKEN -p "$scratch/schema")"
  printf 'header = "Authorization: Bearer %s"\n' "$read_token" |
    curl --fail --silent --show-error --max-time 60 --config - \
      "https://raw.githubusercontent.com/zknicker/agents/${CLOUD_AGENTS_FLEET_REF:-main}/cloud/fleet.tar.gz" |
    tar -xz -C "$scratch"
  test -f "$scratch/agents/cloud/cursor/seed.sh"
  mkdir -p "$HOME/.agents"
  rm -rf "$fleet"
  mv "$scratch/agents" "$fleet"
  rm -rf "$scratch"
}

notice=''
case "$platform" in
  claude)
    if [ ! -f "$HOME/.agents/fleet-loader.sh" ]; then
      notice='The zknicker/agents fleet is not installed: paste its cloud/setup-script.sh into this cloud environment'"'"'s Setup script.'
      log "$notice"
    fi
    ;;
  cursor)
    download_fleet
    bash "$fleet/cloud/cursor/seed.sh" "$root" >&2
    ;;
  *)
    printf 'Unknown cloud agent platform: %s\n' "$platform" >&2
    exit 2
    ;;
esac

cd "$root"
if [ -f "$cloud/env.sh" ]; then
  . "$cloud/env.sh"
fi
if [ "$platform" = claude ]; then
  bash "$cloud/install.sh" >&2
fi
if [ -f "$cloud/start.sh" ]; then
  bash "$cloud/start.sh" >&2
fi

if [ -f "$fleet/cloud/bootstrap.sh" ] && ! cmp -s "$cloud/bootstrap.sh" "$fleet/cloud/bootstrap.sh"; then
  stale='This repo'"'"'s .agents/cloud/bootstrap.sh differs from the fleet copy; refresh it with the cloud-agent-setup skill.'
  log "$stale"
  notice="${notice:+$notice }$stale"
fi

if [ "$platform" = claude ]; then
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    printf '%s\n' 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
    if [ -f "$cloud/env.sh" ]; then
      printf '. %q\n' "$cloud/env.sh" >> "$CLAUDE_ENV_FILE"
    fi
  fi
  node -e 'const context = process.argv[1]; process.stdout.write(`${JSON.stringify(context ? { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } } : {})}\n`)' "$notice"
fi
