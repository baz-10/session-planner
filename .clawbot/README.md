# Session Planner Agent Orchestrator (Pilot)

This folder tracks background coding agents for the `session-planner` pilot.

## Files
- `active-tasks.json` → live task registry

## Conventions
- One task = one worktree + one tmux session
- Branch format: `feat/<task-id>`
- Worktree path: `../session-planner-worktrees/<task-id>`
- Session name: `agent-<task-id>`

## Commands
From repo root:

```bash
# Spawn a Codex agent
scripts/agent-spawn.sh \
  --id copy-save-fix \
  --agent codex \
  --model gpt-5.3-codex \
  --prompt "Investigate and fix session plan copy not saving."

# Check statuses and PR links
scripts/agent-check.sh
```

## Notes
- This pilot keeps merge approval human-in-the-loop.
- Agents can open PRs, but nothing auto-merges.
