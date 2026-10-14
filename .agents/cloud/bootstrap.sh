#!/usr/bin/env bash
# Fleet-owned cloud agent bootstrap from zknicker/agents cloud/bootstrap.sh.
# Product repos keep an exact copy at .agents/cloud/bootstrap.sh; edit it in
# zknicker/agents, not in a product repo.
#
# Usage: bootstrap.sh <claude|cursor-install|cursor>
# Runs this repo's .agents/cloud scripts: env.sh (sourced), install.sh
# (claude and cursor-install), and start.sh (claude and cursor). Claude
# sessions get the fleet from the environment Setup script's session hook
# (cloud/setup-script.sh), which runs alongside this one. Cursor has no such
# hook: cursor-install (the environment's install, run in each Build whose
# disk every agent inherits) downloads the fleet into ~/.agents/fleet and
# seeds Cursor, and cursor (the detached start) refreshes it, keeping the
# Build's fleet when the download fails. The read key resolves from
# 1Password with the CLOUD_AGENTS_DEVELOPMENT_OP_TOKEN every cloud platform
# provides. CLOUD_AGENTS_FLEET_REF selects a fleet branch to trial; it
# defaults to main. ~/.agents/fleet-status records the last Cursor fleet load.
# The cursor start also fast-forwards a clean default-branch checkout.
# Logs go to stderr; for Claude, stdout carries the SessionStart hook JSON.
set -euo pipefail

platform="${1:?Usage: bootstrap.sh <claude|cursor-install|cursor>}"
root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cloud="$root/.agents/cloud"
fleet="$HOME/.agents/fleet"
status_file="$HOME/.agents/fleet-status"
ref="${CLOUD_AGENTS_FLEET_REF:-main}"
# Platform start hooks can run without a login shell; expose the usual
# user-level toolchain locations.
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"

log() {
  printf '[cloud-agent] %s\n' "$1" >&2
}

# Explicit returns: callers test this, which disables errexit inside it.
download_fleet() {
  local scratch read_token
  scratch="$(mktemp -d)" || return 1
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
  if ! read_token="$(cd "$root" && npx --yes varlock@1.16.1 printenv FLEET_GITHUB_READ_TOKEN -p "$scratch/schema")" ||
    ! printf 'header = "Authorization: Bearer %s"\n' "$read_token" |
      curl --fail --silent --show-error --max-time 60 --config - --output "$scratch/fleet.tar.gz" \
        "https://raw.githubusercontent.com/zknicker/agents/$ref/cloud/fleet.tar.gz" ||
    ! tar -xzf "$scratch/fleet.tar.gz" -C "$scratch" ||
    ! test -f "$scratch/agents/cloud/cursor/seed.sh"; then
    rm -rf "$scratch"
    return 1
  fi
  bundle="$(sha256sum "$scratch/fleet.tar.gz" | cut -c1-12)"
  mkdir -p "$HOME/.agents"
  rm -rf "$fleet"
  mv "$scratch/agents" "$fleet"
  rm -rf "$scratch"
}

write_status() {
  mkdir -p "$HOME/.agents"
  printf '%s %s ref=%s bundle=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$ref" "${bundle:-none}" "$2" > "$status_file"
}

# cursor-install fails the Build when the fleet cannot load; the cursor
# start keeps an existing fleet, since nobody sees a detached start fail.
load_cursor_fleet() {
  if download_fleet; then
    write_status ok "$platform: fleet loaded"
    log "Fleet loaded ($ref, bundle $bundle)."
  elif [ "$platform" = cursor ] && [ -f "$fleet/cloud/cursor/seed.sh" ]; then
    write_status stale "$platform: download failed; kept the Build's fleet"
    log "Fleet download failed; keeping the fleet from the last Build."
  else
    write_status failed "$platform: download failed"
    log "Fleet download failed."
    exit 1
  fi
  bash "$fleet/cloud/cursor/seed.sh" "$root" >&2
}

# The cursor start may land on a Build's stale checkout: fast-forward it when
# it sits clean on the remote default branch. Never fails the start.
sync_repo() {
  local default branch old new
  default="$(git -C "$root" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  default="${default#origin/}"
  default="${default:-main}"
  branch="$(git -C "$root" symbolic-ref --short HEAD 2>/dev/null || true)"
  if [ "$branch" != "$default" ]; then
    log "Repo sync skipped: on ${branch:-a detached HEAD}, not $default."
    return
  fi
  # Untracked files (the seeded .agents/skills links) do not block a
  # fast-forward; merge refuses one that would overwrite them.
  if [ -n "$(git -C "$root" status --porcelain --untracked-files=no)" ]; then
    log "Repo sync skipped: uncommitted changes."
    return
  fi
  old="$(git -C "$root" rev-parse --short HEAD)"
  if git -C "$root" fetch --quiet origin "$default" >&2 &&
    git -C "$root" merge --ff-only --quiet "origin/$default" >&2; then
    new="$(git -C "$root" rev-parse --short HEAD)"
    log "Repo $default: $old -> $new."
  else
    log "Repo sync failed; continuing at $old."
  fi
}

notice=''
case "$platform" in
  claude)
    if [ ! -f "$HOME/.agents/fleet-loader.sh" ]; then
      notice='The zknicker/agents fleet is not installed: paste its cloud/setup-script.sh into this cloud environment'"'"'s Setup script.'
      log "$notice"
    fi
    ;;
  cursor-install|cursor)
    if [ "$platform" = cursor ]; then
      sync_repo
    fi
    load_cursor_fleet
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
if [ "$platform" != cursor ]; then
  bash "$cloud/install.sh" >&2
fi
if [ "$platform" != cursor-install ] && [ -f "$cloud/start.sh" ]; then
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
