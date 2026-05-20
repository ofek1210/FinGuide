---
name: jira-sync
description: >
  Syncs tasks with Jira at the start and end of every Claude Code session, and on demand.
  Use this skill at the START of every session to load open Jira tasks and understand what to work on.
  Use this skill at the END of every session to mark completed tasks as Done and open new tasks if needed.
  Also trigger whenever the user mentions Jira, tasks, tickets, "mark as done", "open a ticket",
  "what's my next task", "update Jira", or when Claude detects a feature/fix has been completed.
  Always prefer this skill over generic API calls when working with the KAN Jira project.
---

# Jira Sync Skill

Connects Claude Code to the user's Jira Cloud project to manage tasks automatically.

## Configuration

- **Jira Domain:** `finguide.atlassian.net`
- **Project Key:** `KAN`
- **User Email:** `ofekdil1210@gmail.com`
- **API Token:** Read from env var `JIRA_API_TOKEN`
- **Base URL:** `https://finguide.atlassian.net/rest/api/3`

### Auth header (base64 of email:token)
```
Authorization: Basic <base64(ofekdil1210@gmail.com:JIRA_API_TOKEN)>
Content-Type: application/json
```

In bash/node, build it like:
```bash
AUTH=$(echo -n "ofekdil1210@gmail.com:$JIRA_API_TOKEN" | base64)
```

---

## Status Mapping

| Status Name   | Meaning                        |
|---------------|-------------------------------|
| `To Do`       | Not started yet               |
| `In Progress` | Currently being worked on     |
| `Done`        | Completed                     |

---

## Category → Parent Epic

Tasks in KAN are categorized by **parent epic**, not by labels. Every new task MUST be linked to one of these four epics via the `parent` field. Pick the epic whose scope best matches the work.

| Category | Epic Key   | Use when the task is about…                                                  |
|----------|------------|-------------------------------------------------------------------------------|
| Backend  | `KAN-4`    | Express/Node routes, controllers, DB schemas, auth, middleware, server logic |
| Frontend | `KAN-85`   | React components, pages, hooks, styling, UX, client-side state, routing      |
| AI       | `KAN-79`   | LLM prompts, agent flows, classification, embeddings, AI feature integration |
| OCR      | `KAN-6`    | Document scanning, image preprocessing, text extraction, OCR pipeline        |

**Classification rules:**
- If the task spans frontend + backend, prefer the side where the bulk of the work happens; if truly even, default to **Backend**.
- OCR work is its own bucket — do not file it under Backend even if it touches the server.
- AI bucket is for LLM/model logic specifically; if it's just an API endpoint that calls an AI service, it's still **Backend** unless the prompt/agent design is the core of the ticket.
- If unsure, **ask the user before creating** — do not guess.

---

## Workflows

### 1. SESSION START — Load open tasks

Run this at the beginning of every Claude Code session.

**Goal:** Understand what's open and what's in progress.

```bash
# Fetch open tasks
curl -s -X GET \
  "https://finguide.atlassian.net/rest/api/3/search?jql=project=KAN AND status in ('To Do','In Progress') ORDER BY created ASC&fields=summary,status,priority,description" \
  -H "Authorization: Basic $(echo -n 'ofekdil1210@gmail.com:'"$JIRA_API_TOKEN"'' | base64)" \
  -H "Content-Type: application/json"
```

After fetching, present a brief summary to the user:
- How many tasks are open
- Which are "In Progress"
- Ask: "Which task should we focus on this session?" (if not already clear from context)

If a task is mentioned by the user naturally (e.g. "let's fix the login bug"), find the matching Jira ticket and move it to **In Progress** automatically.

---

### 2. MARK TASK AS IN PROGRESS

When starting work on a task, transition it to In Progress.

```bash
# Step 1: Get available transitions
curl -s "https://finguide.atlassian.net/rest/api/3/issue/KAN-{ID}/transitions" \
  -H "Authorization: Basic $(echo -n 'ofekdil1210@gmail.com:'"$JIRA_API_TOKEN"'' | base64)" \
  -H "Content-Type: application/json"

# Step 2: Apply transition (use the transition ID for "In Progress")
curl -s -X POST \
  "https://finguide.atlassian.net/rest/api/3/issue/KAN-{ID}/transitions" \
  -H "Authorization: Basic $(echo -n 'ofekdil1210@gmail.com:'"$JIRA_API_TOKEN"'' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"transition": {"id": "{TRANSITION_ID}"}}'
```

---

### 3. MARK TASK AS DONE

Trigger this when:
- User explicitly says "done", "finished", "סיימתי", "זה מוכן"
- Claude detects the code/fix is complete and working (tests pass, feature implemented)
- End of session

```bash
# Step 1: Get transitions to find "Done" ID
curl -s "https://finguide.atlassian.net/rest/api/3/issue/KAN-{ID}/transitions" \
  -H "Authorization: Basic $(echo -n 'ofekdil1210@gmail.com:'"$JIRA_API_TOKEN"'' | base64)" \
  -H "Content-Type: application/json"

# Step 2: Transition to Done
curl -s -X POST \
  "https://finguide.atlassian.net/rest/api/3/issue/KAN-{ID}/transitions" \
  -H "Authorization: Basic $(echo -n 'ofekdil1210@gmail.com:'"$JIRA_API_TOKEN"'' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"transition": {"id": "{DONE_TRANSITION_ID}"}}'
```

---

### 4. OPEN A NEW TASK

Trigger when:
- User mentions a new bug, feature, or follow-up work
- Claude identifies a known issue that should be tracked
- User says "פתח טיקט", "תוסיף משימה", "open a ticket"

**Before creating:** classify the task into one of the four categories (Backend / Frontend / AI / OCR — see "Category → Parent Epic" table above) and pick the matching `EPIC_KEY`. Confirm the title, description, and chosen epic with the user.

```bash
# {EPIC_KEY} must be one of: KAN-4 (Backend), KAN-85 (Frontend), KAN-79 (AI), KAN-6 (OCR)
curl -s -X POST \
  "https://finguide.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic $(echo -n 'ofekdil1210@gmail.com:'"$JIRA_API_TOKEN"'' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": {"key": "KAN"},
      "parent": {"key": "{EPIC_KEY}"},
      "summary": "{TASK_TITLE}",
      "description": {
        "type": "doc",
        "version": 1,
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "{TASK_DESCRIPTION}"}]}]
      },
      "issuetype": {"name": "Task"}
    }
  }'
```

Always confirm the task title, description, and **parent epic** with the user before creating.

#### Re-tagging an existing task

If a task was created without a parent or under the wrong epic, fix it with:

```bash
curl -s -X PUT \
  "https://finguide.atlassian.net/rest/api/3/issue/KAN-{ID}" \
  -H "Authorization: Basic $(echo -n 'ofekdil1210@gmail.com:'"$JIRA_API_TOKEN"'' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"parent": {"key": "{EPIC_KEY}"}}}'
```

---

### 5. SESSION END — Wrap up

At the end of every session:

1. List tasks that were worked on
2. Ask user to confirm which are **Done** (if not already transitioned)
3. Mark confirmed tasks as Done
4. Ask: "יש משימות חדשות שצריך לפתוח?"
5. If yes, create them with a short description

---

## Error Handling

- If `JIRA_API_TOKEN` is not set → "הטוקן לא מוגדר. הרץ: `echo 'export JIRA_API_TOKEN=\"your_token\"' >> ~/.zshrc && source ~/.zshrc`"
- If API returns 401 → token is invalid or expired, ask user to regenerate at https://id.atlassian.com/manage-api-tokens
- If transition fails → fetch available transitions first and log them for debugging
- If issue not found → double-check the KAN-{ID} format and confirm with user

---

## Tips

- Always show the Jira issue key (e.g. `KAN-12`) alongside the task title so the user can verify
- When in doubt about which ticket matches the work being done, ask the user
- Prefer to batch updates (mark multiple as done at once) rather than interrupting mid-session
