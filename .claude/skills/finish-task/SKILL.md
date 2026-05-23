---
name: finish-task
description: >
  Wraps up a finished task or feature: creates a task-named branch (if needed), stages and commits
  with a clean conventional-commits message, pushes, and opens a PR with a structured body.
  Trigger when the user says "סיימתי", "finished", "זה מוכן", "open a PR", "תעלה קומיט", "תפתח PR",
  or otherwise signals that a unit of work is complete and ready to ship. Coordinates with the
  jira-sync skill to keep the Jira ticket in sync (status + linkage in the PR body).
---

# Finish Task Skill

Ships a completed task end-to-end: branch → commit → push → PR, with messages tied to the Jira ticket.

## When to run

Trigger when the user signals a unit of work is done:
- "סיימתי", "זה מוכן", "finished", "done"
- "תעלה קומיט", "open a commit", "תפתח PR", "open a PR"
- After Claude completes a feature/fix and tests pass

If unclear which Jira ticket is being closed, **ask the user before doing anything** — do not guess from the diff alone.

---

## Conventions (use these defaults — do not invent new ones)

### Branch naming

```
<type>/KAN-<id>-<short-kebab-summary>
```

- `<type>`: `feat` (new feature), `fix` (bug fix), `refactor`, `chore`, `docs`, `test`
- `<id>`: Jira issue numeric ID
- `<short-kebab-summary>`: 3–6 words, lowercase, hyphenated, derived from the Jira summary (English; transliterate or translate Hebrew summaries to short English slugs)

**Examples:**
- `feat/KAN-114-onboarding-intro-modal`
- `fix/KAN-72-ocr-table-extraction`
- `refactor/KAN-90-auth-middleware`

### Commit message

Conventional Commits with scope from the parent epic:

```
<type>(<scope>): <subject>

<body — optional, only if the WHY isn't obvious from subject>

Refs KAN-<id>
```

| Epic       | Scope      |
|------------|------------|
| Backend    | `backend`  |
| Frontend   | `frontend` |
| AI         | `ai`       |
| OCR        | `ocr`      |

- **Subject:** imperative, lowercase, ≤72 chars, no trailing period.
- **Body:** only when needed — explain WHY, not WHAT. Skip for self-evident changes.
- Use `Refs KAN-<id>` (not `Closes`) on commits. `Closes` belongs in the PR body so the ticket transitions on merge, not on every commit.

### PR title & body

**Title:** same as the commit subject (without the `Refs` line). Keep ≤70 chars.

**Body template:**
```markdown
## Summary
<1–3 bullets — what changed and why>

## Changes
- <bulleted list of notable changes, grouped by area if useful>

## Test plan
- [ ] <step or check>
- [ ] <step or check>

Jira: [KAN-<id>](https://finguide.atlassian.net/browse/KAN-<id>)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

The Jira link is for human visibility only. **There is no GitHub↔Jira integration installed on this project**, so `Closes KAN-<id>` would NOT auto-transition the ticket. The status sync is handled explicitly in Step 7 below.

---

## Workflow

### Step 1 — Identify the Jira ticket

If the user didn't name a ticket explicitly:
1. Check if the current branch already encodes a `KAN-<id>` — use that.
2. Otherwise, list "In Progress" tickets via the jira-sync skill and ask the user which one this work closes.

Once identified, fetch the ticket's `summary`, `issuetype`, and `parent` (epic) — these drive `<type>`, `<short-kebab-summary>`, and `<scope>`.

```bash
AUTH=$(printf '%s' "ofekdil1210@gmail.com:$JIRA_API_TOKEN" | base64 | tr -d '\n')
curl -s "https://finguide.atlassian.net/rest/api/3/issue/KAN-{ID}?fields=summary,issuetype,parent,status" \
  -H "Authorization: Basic $AUTH" -H "Accept: application/json"
```

Map the parent epic key → scope:
- `KAN-4` → `backend`
- `KAN-85` → `frontend`
- `KAN-79` → `ai`
- `KAN-6` → `ocr`

If the ticket has no parent, ask the user which scope to use.

### Step 2 — Get on the right branch

```bash
git status --short
git rev-parse --abbrev-ref HEAD
```

Decision tree:
- **On `main` or `master`** → always create a new branch.
- **On an existing `<type>/KAN-<id>-...` branch matching this ticket** → stay on it.
- **On a feature branch unrelated to the ticket** → ask the user: continue here, branch off, or stash.

To create the branch (off the latest `main`):

```bash
git fetch origin main --quiet
git checkout -b <type>/KAN-<id>-<short-kebab-summary> origin/main
```

If there are uncommitted changes already in the working tree that belong to this task, they'll carry over to the new branch via `git checkout -b` — that is the desired behavior. **Do not** stash silently.

### Step 3 — Review and stage changes

```bash
git status --short
git diff --stat
```

- Show the user the file list before staging.
- Stage explicitly by path (`git add <files>`); avoid `git add -A` / `git add .` to prevent picking up unrelated work, secrets, or large binaries.
- If `.env`, credential files, or anything that looks like a secret appears in the diff, **stop and warn the user**.

### Step 4 — Commit

Compose the message from the Jira summary + epic scope. Pass via heredoc to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

<optional body>

Refs KAN-<id>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If a pre-commit hook fails, **fix the underlying issue** and create a new commit. Never use `--no-verify` to bypass.

### Step 5 — Push

```bash
git push -u origin HEAD
```

If the branch already exists on remote and has diverged, ask before force-pushing. Never force-push to `main`.

### Step 6 — Open the PR

Use `gh pr create` with the structured body. Pass the body via heredoc.

```bash
gh pr create \
  --base main \
  --title "<commit subject>" \
  --body "$(cat <<'EOF'
## Summary
- <1–3 bullets>

## Changes
- <list>

## Test plan
- [ ] <check>

Jira: [KAN-<ID>](https://finguide.atlassian.net/browse/KAN-<ID>)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After the PR is opened, return the PR URL to the user.

### Step 7 — Sync Jira

This project has **no GitHub↔Jira integration**, so the ticket will not transition on its own. Handle it explicitly:

1. **Ensure the ticket is `In Progress`.** If it's still `To Do`, transition it via the jira-sync skill (transition id `21`).
2. **Post a comment on the ticket linking the PR** (so the work is traceable from Jira):

   ```bash
   AUTH=$(printf '%s' "ofekdil1210@gmail.com:$JIRA_API_TOKEN" | base64 | tr -d '\n')
   curl -s -X POST \
     "https://finguide.atlassian.net/rest/api/3/issue/KAN-{ID}/comment" \
     -H "Authorization: Basic $AUTH" -H "Content-Type: application/json" \
     -d '{"body":{"type":"doc","version":1,"content":[{"type":"paragraph","content":[{"type":"text","text":"PR opened: "},{"type":"text","text":"<PR_URL>","marks":[{"type":"link","attrs":{"href":"<PR_URL>"}}]}]}]}}'
   ```

3. **Do NOT mark the ticket `Done` when opening the PR.** The PR may still need review/changes. Mark it `Done` only after the PR is actually merged — when the user confirms the merge (or runs the jira-sync skill at session end), transition the ticket then.

If the user explicitly asks for "mark it Done now" at PR-open time (some workflows prefer this), comply — but default to leaving it `In Progress`.

---

## Type inference

If the Jira `issuetype` is set, use it to pick `<type>`:
- `Task` (default) → `feat` if introducing new behavior, `chore` if internal/no user-facing change
- `Bug` → `fix`
- `Story` → `feat`
- `Sub-task` → inherit from parent

If unsure, **ask the user** rather than guessing.

---

## Guardrails

- Never run destructive git operations (`reset --hard`, `push --force`, `branch -D`) without explicit user approval.
- Never commit `.env`, credentials, large binaries, or generated artifacts.
- Never skip hooks (`--no-verify`).
- Never amend a published commit; create a new commit instead.
- If the user is on `main`/`master` with uncommitted changes, **always** create a branch — do not commit to main.
- If `gh` is not authenticated, surface the error to the user and stop; do not try to work around it.
- If `JIRA_API_TOKEN` is missing, you can still complete the git/PR flow — just skip the Jira lookups and ask the user for the ticket details and scope manually.

---

## Quick examples

**User:** "סיימתי את המודאל של ה-onboarding (KAN-114), תעלה PR"

→ Branch: `feat/KAN-114-onboarding-intro-modal`
→ Commit: `feat(frontend): add onboarding intro modal\n\nRefs KAN-114`
→ PR title: `feat(frontend): add onboarding intro modal`
→ PR body: summary + `Closes KAN-114`

**User:** "fixed the OCR table parser, push it"

→ Ask: which Jira ticket? (don't guess)
→ Once given KAN-72: branch `fix/KAN-72-ocr-table-parser`, commit `fix(ocr): correct table column extraction`, etc.
