#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_FILE="$REPO_DIR/.clawbot/active-tasks.json"

if [[ ! -f "$TASKS_FILE" ]]; then
  echo "No tasks file found: $TASKS_FILE"
  exit 0
fi

python3 - <<PY
import json, subprocess, pathlib, shlex, time
p = pathlib.Path(r'''$TASKS_FILE''')
tasks = json.loads(p.read_text() or '[]')
changed = False

for t in tasks:
    sid = t.get('tmuxSession')
    if not sid:
        continue

    alive = subprocess.run(['tmux','has-session','-t',sid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0

    if t.get('status') == 'running' and not alive:
        t['status'] = 'finished'
        t['finishedAt'] = int(time.time()*1000)
        changed = True

    branch = t.get('branch')
    if branch:
        try:
            out = subprocess.check_output(['gh','pr','list','--repo','baz-10/session-planner','--head',branch,'--json','number,url,state'], stderr=subprocess.DEVNULL).decode()
            prs = json.loads(out)
            if prs:
                t['pr'] = prs[0]
                changed = True
        except Exception:
            pass

if changed:
    p.write_text(json.dumps(tasks, indent=2) + '\n')

print('Task status:')
for t in tasks:
    pr = t.get('pr')
    pr_txt = f" PR#{pr.get('number')}" if isinstance(pr, dict) and pr.get('number') else ''
    print(f"- {t.get('id')}: {t.get('status')} ({t.get('agent')}){pr_txt}")
PY