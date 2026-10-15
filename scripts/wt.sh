#!/usr/bin/env bash
# Create or remove a task worktree. Run from the repo root.
set -euo pipefail

usage() {
  cat <<'EOF'
usage: scripts/wt.sh new <id>
       scripts/wt.sh rm <id>
EOF
  exit 1
}

if [[ $# -ne 2 ]]; then
  usage
fi

cmd="$1"
id="$2"
dir="../gh-${id}"
branch="hack/${id}"

case "$cmd" in
  new)
    git worktree add "$dir" -b "$branch" main
    if [[ -f .env ]]; then
      cp .env "${dir}/.env"
    fi
    (cd "$dir" && npm install)
    echo "export SB_GRAPH=sb_${id}"
    ;;
  rm)
    git worktree remove "$dir"
    git branch -d "$branch"
    ;;
  *)
    usage
    ;;
esac
