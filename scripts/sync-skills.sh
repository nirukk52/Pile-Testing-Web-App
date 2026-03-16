#!/usr/bin/env bash
set -euo pipefail

REPO_SKILLS_DIR="/Users/priyankalalge/PileTesting/Pile-testing-web-app/Pile-Testing-Web-App/.claude/skills"
RUNTIME_SKILLS_DIR="${HOME}/.agents/skills"

DEFAULT_SKILLS=(
  "piletest-pro"
  "piletest-parity"
  "skill-creator"
)

usage() {
  cat <<EOF
Usage:
  $(basename "$0")                 # sync default skills
  $(basename "$0") --all           # sync all skills from repo/.claude/skills
  $(basename "$0") skill1 skill2   # sync specific skills

Option A policy:
  Source of truth: repo/.claude/skills
  Runtime copy:    ~/.agents/skills
EOF
}

if [[ ! -d "$REPO_SKILLS_DIR" ]]; then
  echo "❌ Repo skills dir not found: $REPO_SKILLS_DIR"
  exit 1
fi

mkdir -p "$RUNTIME_SKILLS_DIR"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

skills_to_sync=()
if [[ "${1:-}" == "--all" ]]; then
  while IFS= read -r -d '' d; do
    skills_to_sync+=("$(basename "$d")")
  done < <(find "$REPO_SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d -print0)
elif [[ "$#" -gt 0 ]]; then
  skills_to_sync=("$@")
else
  skills_to_sync=("${DEFAULT_SKILLS[@]}")
fi

synced=0
for skill in "${skills_to_sync[@]}"; do
  src="$REPO_SKILLS_DIR/$skill"
  dst="$RUNTIME_SKILLS_DIR/$skill"

  if [[ ! -d "$src" ]]; then
    echo "⚠️  Skip missing skill in repo: $skill"
    continue
  fi

  rm -rf "$dst"
  cp -R "$src" "$dst"
  echo "✅ Synced: $skill"
  synced=$((synced + 1))
done

echo "\nDone. Synced $synced skill(s) to $RUNTIME_SKILLS_DIR"
ls -1 "$RUNTIME_SKILLS_DIR" | sed 's/^/ - /'
