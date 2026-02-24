#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_FILE="$REPO_DIR/.clawbot/active-tasks.json"
WORKTREES_BASE="$(cd "$REPO_DIR/.." && pwd)/session-planner-worktrees"

ID=""
AGENT="codex"
MODEL="gpt-5.3-codex"
PROMPT=""
BASE_REF="origin/main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id) ID="$2"; shift 2 ;;
    --agent) AGENT="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --prompt) PROMPT="$2"; shift 2 ;;
    --base) BASE_REF="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$ID" || -z "$PROMPT" ]]; then
  echo "Usage: scripts/agent-spawn.sh --id <task-id> --prompt <text> [--agent codex|claude] [--model <model>] [--base origin/main]"
  exit 1
fi

mkdir -p "$WORKTREES_BASE"
mkdir -p "$(dirname "$TASKS_FILE")"
[[ -f "$TASKS_FILE" ]] || echo '[]' > "$TASKS_FILE"

BRANCH="feat/$ID"
WORKTREE="$WORKTREES_BASE/$ID"
SESSION="agent-$ID"

cd "$REPO_DIR"
git fetch origin --prune

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Branch $BRANCH already exists locally."
else
  git worktree add "$WORKTREE" -b "$BRANCH" "$BASE_REF"
fi

if [[ ! -d "$WORKTREE" ]]; then
  git worktree add "$WORKTREE" "$BRANCH"
fi

CMD=""
if [[ "$AGENT" == "codex" ]]; then
  CMD="cd '$WORKTREE' && codex exec --full-auto \"$PROMPT\""
elif [[ "$AGENT" == "claude" ]]; then
  CMD="cd '$WORKTREE' && claude \"$PROMPT\""
else
  echo "Unsupported agent: $AGENT"
  exit 1
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session $SESSION already exists"
  exit 1
fi

tmux new-session -d -s "$SESSION" "$CMD"

python3 - <<PY
import json, time, pathlib
p = pathlib.Path(r'''$TASKS_FILE''')
data = json.loads(p.read_text() or '[]')
entry = {
  "id": "$ID",
  "agent": "$AGENT",
  "model": "$MODEL",
  "branch": "$BRANCH",
  "worktree": "$WORKTREE",
  "tmuxSession": "$SESSION",
  "prompt": "$PROMPT",
  "status": "running",
  "startedAt": int(time.time()*1000),
  "pr": None,
}
data = [d for d in data if d.get('id') != "$ID"]
data.append(entry)
p.write_text(json.dumps(data, indent=2) + "\n")
print(f"Registered task: {entry['id']}")
PY

echo "Spawned $AGENT task '$ID'"
echo "- worktree: $WORKTREE"
echo "- branch:   $BRANCH"
echo "- tmux:     $SESSION"
echo "- tail log: tmux capture-pane -pt $SESSION | tail -n 40"