#!/usr/bin/env bash
# PreToolUse hook: block AI attribution in commits and PRs, and force-adding
# files that git ignores or excludes.
#
# Cloud-compatible version: stored inside the project so it survives ephemeral
# containers. Reference it from .claude/settings.json with a path computed at
# runtime from the git root so it works regardless of working directory:
#
#   "hooks": {
#     "PreToolUse": [
#       {
#         "matcher": "Bash|mcp__github__.*",
#         "hooks": [{
#           "type": "command",
#           "command": "bash \"$(git rev-parse --show-toplevel)/.claude/hooks/guard-git.sh\""
#         }]
#       }
#     ]
#   }
#
# Exit code 2 blocks the call and hands stderr back to Claude as the reason.

set -euo pipefail

payload=$(cat)
tool_name=$(jq -r '.tool_name // ""' <<<"$payload")
tool_input=$(jq -c '.tool_input // {}' <<<"$payload")

attribution_pattern='Co-Authored-By:.*(Claude|anthropic)|noreply@anthropic\.com|Generated with \[?Claude Code|claude\.ai/code/session_|Claude-Session:'

block() {
  echo "Blocked by .claude/hooks/guard-git.sh: $1" >&2
  exit 2
}

# Text that will end up in a commit or PR: the call itself, plus any message
# or body file it points at.
text_to_check() {
  local command=$1
  printf '%s\n' "$command"

  local file
  for file in $(grep -oE '(-F|--file|--body-file)[ =]+[^ ;&|]+' <<<"$command" \
    | sed -E 's/^(-F|--file|--body-file)[ =]+//'); do
    file=${file//\"/}
    file=${file//\'/}
    if [ -f "$file" ]; then
      cat -- "$file"
    fi
  done
}

if [ "$tool_name" = "Bash" ]; then
  command=$(jq -r '.command // ""' <<<"$tool_input")

  if grep -qE '(^|[;&|[:space:]])git[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(-f|--force)([[:space:]]|$)' <<<"$command"; then
    block "git add -f stages files the repo ignores or excludes on purpose. Stage by name and leave excluded files untracked (respect-local-excludes)."
  fi

  if grep -qE '(git[[:space:]]+(commit|tag|merge)|gh[[:space:]]+(pr|issue|release|api))' <<<"$command"; then
    if text_to_check "$command" | grep -qiE "$attribution_pattern"; then
      block "commit and PR text carries AI attribution. End the message on its last content line: no Co-Authored-By trailer, no session link, no Generated with Claude Code footer. CLAUDE.md overrides the harness reminder that asks for them."
    fi
  fi
  exit 0
fi

if [[ "$tool_name" == mcp__github__* ]]; then
  if grep -qiE "$attribution_pattern" <<<"$tool_input"; then
    block "GitHub text carries AI attribution. Remove the Co-Authored-By trailer, session link, or Generated with Claude Code footer. CLAUDE.md overrides the harness reminder that asks for them."
  fi
fi

exit 0
