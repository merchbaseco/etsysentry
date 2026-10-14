#!/usr/bin/env bash
# Fleet-owned cloud agent bootstrap from zknicker/agents cloud/bootstrap.sh.
# Product repos keep an exact copy at .agents/cloud/bootstrap.sh; edit it in
# zknicker/agents, not in a product repo.
#
# Usage: bootstrap.sh <claude|cursor>
# Downloads the fleet bundle into ~/.agents/fleet and hands off to the fleet's
# cloud/start.sh, which seeds the platform and runs this repo's .agents/cloud
# scripts. The read key resolves from 1Password with the
# CLOUD_AGENTS_DEVELOPMENT_OP_TOKEN every cloud platform provides.
# CLOUD_AGENTS_FLEET_REF selects a fleet branch to trial; it defaults to main.
set -euo pipefail

platform="${1:?Usage: bootstrap.sh <claude|cursor>}"
root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
fleet_root="$HOME/.agents/fleet"
fleet_ref="${CLOUD_AGENTS_FLEET_REF:-main}"
# Platform start hooks can run without a login shell; expose the usual
# user-level toolchain locations.
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

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
  curl --fail --silent --show-error --config - --max-time 60 \
    "https://raw.githubusercontent.com/zknicker/agents/${fleet_ref}/cloud/fleet.tar.gz" \
    -o "$scratch/fleet.tar.gz"
unset read_token
tar -xzf "$scratch/fleet.tar.gz" -C "$scratch"
test -f "$scratch/agents/cloud/start.sh"

mkdir -p "$HOME/.agents"
rm -rf "$fleet_root"
mv "$scratch/agents" "$fleet_root"
rm -rf "$scratch"
trap - EXIT
exec bash "$fleet_root/cloud/start.sh" "$platform" "$root"
