#!/usr/bin/env bash
# Installs the two launchd jobs (server and tunnel) for the public host.
# The owner runs this on the always-on Mac, after deploy/RUNBOOK.md steps 1 to 3:  bash deploy/install.sh
# Safe to run again: it replaces the loaded jobs.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
agents="$HOME/Library/LaunchAgents"
logs="$HOME/Library/Logs/switchboard"
domain="gui/$(id -u)"
labels=(xyz.switchboard.server xyz.switchboard.tunnel)

die() { echo "install.sh: $*" >&2; exit 1; }
plist_value() { /usr/libexec/PlistBuddy -c "Print $2" "$here/$1.plist"; }

for label in "${labels[@]}"; do plutil -lint "$here/$label.plist" >/dev/null || die "$label.plist is not valid"; done

# The plists hold absolute paths. Stop here if any of them is wrong on this Mac.
node_bin="$(plist_value xyz.switchboard.server :ProgramArguments:0)"
repo="$(plist_value xyz.switchboard.server :WorkingDirectory)"
[[ -x "$node_bin" ]] || die "node not found at $node_bin (edit xyz.switchboard.server.plist; \`command -v node\`)"
[[ -d "$repo/node_modules/tsx" ]] || die "no node_modules/tsx in $repo (run npm ci there, or fix WorkingDirectory)"
[[ -x /opt/homebrew/bin/cloudflared ]] || die "cloudflared not found at /opt/homebrew/bin/cloudflared"
[[ -f "$HOME/.cloudflared/config.yml" ]] || die "~/.cloudflared/config.yml is missing (RUNBOOK step 3)"
! grep -q '<UUID>' "$HOME/.cloudflared/config.yml" || die "~/.cloudflared/config.yml still contains <UUID>"

mkdir -p "$agents" "$logs"
for label in "${labels[@]}"; do
  cp "$here/$label.plist" "$agents/$label.plist"
  launchctl bootout "$domain/$label" 2>/dev/null || true
  launchctl bootstrap "$domain" "$agents/$label.plist"
  launchctl kickstart -k "$domain/$label"
  echo "started $label"
done

echo "Logs: $logs"
echo "Check: curl -fsS http://127.0.0.1:8788/api/health"
