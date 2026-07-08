---
name: live-site-agent-test
description: >
  Stand up a fully-working live FinGuide environment (real backend + frontend + a seeded
  real user with real payslips/insurance/pension data + working AI engines) and drive it
  through the browser Preview so an agent can verify the site against real state. Trigger
  whenever the user wants to write or run an agent/check that tests, verifies, or QAs the
  actual running site — e.g. "כתוב סוכן שבודק את האתר", "run an agent against the site",
  "בדוק את ה-Hub עם משתמש אמיתי", "verify this page end-to-end", "test the live app".
  ALWAYS use this skill instead of ad-hoc seeding/login when a task involves exercising the
  real site behind auth with real data.
---

# Live Site Agent Test

Spins up everything needed to exercise the real FinGuide app behind auth, then verifies
through the browser Preview tools. The whole point: an agent tests against **real data and
real AI**, not mocks and not the empty logged-out shell.

Use this any time the work is "run/write an agent that checks the site." Do the setup
(Steps 1–5) first, then run whatever verification the task asks for (Step 6).

---

## Prerequisites (verify once, fix if missing)

| Dependency | Check | If missing |
|---|---|---|
| MongoDB on :27017 | `Test-NetConnection 127.0.0.1 -Port 27017` | start local mongod / `npm run dev:docker` |
| `backend/.env` present | `ls backend/.env` | copy from the main checkout `C:\Users\ofekd\FG\backend\.env` |
| Ollama running on :11434 | `Test-NetConnection 127.0.0.1 -Port 11434` | start `ollama serve` (binary at `~/AppData/Local/Programs/Ollama/ollama.exe`) |
| Ollama chat model | `ollama list` | `ollama pull llama3.2:1b` (small/fast) — and set `OLLAMA_MODEL` in `.env` to match |
| Ollama embed model (RAG) | `ollama list \| grep all-minilm` | `ollama pull all-minilm` |

The backend reads `.env` **at boot** — if you change `.env`, restart the backend server.

---

## Step 1 — Seed a real user with real data

```bash
cd backend && npm run seed:test-account
```

This runs [`backend/scripts/seedTestAccount.js`](../../../backend/scripts/seedTestAccount.js),
which is **idempotent** (wipes any previous seed for the same email, then rebuilds a fresh
snapshot). It creates one user (`agent.tester@finguide.dev` / `AgentTest123!`) with:

- completed onboarding profile (married, 2 kids, owns apartment + mortgage, etc.)
- 3 payslip Documents (Mar–May 2026) with real `analysisData`, ending in a **+3.78% raise**
- insurance imported through the **real Har HaBituach pipeline** — 5 policies incl. a
  deliberate **duplicate health pair** and a deliberate **missing disability (אכ"ע) gap**
- pension imported through the **real Har HaKesef pipeline** — a comprehensive fund with an
  **above-market management fee** + a healthy study fund
- populated Insights + Recommendations (runs `insightsEngine` + `insuranceRecommender`)

**Capture the JWT** printed at the end — you'll inject it into the Preview in Step 4.
(Override the account with `--email x --password y` or `SEED_EMAIL` / `SEED_PASSWORD`.)

### Expected ground-truth after seeding (what a passing test should observe)

Use these to assert the agents are reading real data, not mocks:

| Domain | Expected on the Hub / analysis |
|---|---|
| Payslips | 3 analyzed · latest gross **₪19,200** · salary trend **+3.78%** |
| Insurance | **5 policies** · **1 duplicate** (health: הראל + כלל בריאות) · waste **₪185/mo** · verdict REVIEW · **missing disability** flagged |
| Pension | monthly deposit **₪4,163** · projected pension **₪33,469** · pension score **61** · verdict SWITCH ("שקול קרן", above-market fee) |
| Global health | ~**65/100** ("יש מקום לשיפור") · categories: מוכנות מס 35% · עקביות פנסיה 100% · מודעות סיכון וביטוח 93% |

These numbers are deterministic from the seed; if a run shows demo values (e.g. 62/100,
"פוליסות 0") the agent is on `demo=true` or not authenticated — fix that, don't accept it.

---

## Step 2 — Make the AI engines answer for real

The site has several AI engines with **different LLM gating** (know which you're testing):

| Engine | Route | Uses |
|---|---|---|
| Hybrid chat | `POST /api/ai/chat`, `/chat/stream` | Claude → **Ollama fallback** |
| Agent router + specialists (+RAG) | `POST /api/agents/ask` | Claude → **Ollama fallback**, RAG via `all-minilm` |
| Multi-agent full-analysis **narration** | `POST /api/ai/full-analysis` | **Claude only** — gated on `ANTHROPIC_API_KEY`; otherwise rule-based summary |
| Financial tips / monthly report | `/api/ai/financial-tips`, `/api/copilot/monthly-report` | Claude enhancement, else rule-based |

To get **real LLM text** (not "שירות ה-AI אינו זמין" / rule fallback):

- **Preferred (production-identical):** put `ANTHROPIC_API_KEY=sk-ant-…` in `backend/.env`.
  This lights up *every* engine including full-analysis narration, tips, and reports.
- **Free / local:** ensure Ollama is up with a chat model, and set `OLLAMA_MODEL` in `.env`
  to a model you actually have (`llama3.2:1b`). This covers chat + `/agents/ask`. Note the
  full-analysis narration stays rule-based unless a Claude key is present **or** the ai/agents
  have been given an Ollama fallback (see the `askAgentLLM` helper in `backend/ai/llm.js` if
  present).
- **RAG:** index the knowledge base once per fresh store:
  `POST /api/agents/rag/index` (auth) — otherwise `/agents/ask` answers without retrieval.

Restart the backend after any `.env` change.

---

## Step 3 — Start the servers via Preview

Use the Preview tooling (never `Bash` for servers):

- `preview_start` with `"backend"` → serves on **:5001**.
- `preview_start` with `"frontend"` → Vite. If :5173 is taken it auto-assigns; read the real
  port from `preview_logs` (search "Local"). The Vite proxy sends `/api` → the backend.

If a port is held by another chat's server, flip `autoPort: true` for that entry in
`.claude/launch.json`, start, then read the assigned port from the logs.

---

## Step 4 — Authenticate the Preview session

The Preview opens logged-out. Inject the seeded JWT **on the app's own origin** (localStorage
is blocked on `data:`/`chrome-error:` pages — navigate to the app first):

```js
// via preview_eval, after navigating to http://localhost:<port>/hub
localStorage.setItem("token", "<JWT from Step 1>");
window.location.href = "/hub";
```

Confirm you're really in: `preview_snapshot` should show the greeting **"בוקר טוב, נועה"**
(the seeded user's name) — not the onboarding intro or the landing page. If it redirects to
`/onboarding`, the profile isn't marked complete (re-run the seed).

---

## Step 5 — Sanity-check the data is live

Before running the real test, confirm real data flows:

- Run a full analysis (click "הרץ ניתוח מלא" or `POST /api/ai/full-analysis`) and assert the
  three lanes show the Step-1 ground-truth numbers.
- For an AI-text engine, send one message and assert the response is real prose, not the
  "שירות ה-AI אינו זמין" fallback.

---

## Step 6 — Run the agent / verification

Now do the task's actual check. Prefer text-based Preview tools over screenshots for
assertions (`preview_snapshot`, `preview_eval` reading DOM, `preview_network` for API
payloads); use `preview_screenshot` only for visual proof. Drive interactions with
`preview_eval` clicks + re-read state.

When launching a subagent to do the checking, hand it: the app URL + port, the injected-token
snippet, and the **ground-truth table** from Step 1 so it can assert against known values.

---

## Guardrails

- The seed is **idempotent and destructive for its own email only** — it never touches other
  users. Don't point `--email` at a real account.
- Never commit `backend/.env` or any `ANTHROPIC_API_KEY`.
- Broad `document.querySelectorAll(...).click()` in `preview_eval` can hit a stray nav button
  and change routes — scope selectors, and re-navigate to `/hub` if the SPA state resets.
- `GSI_LOGGER` popup errors in the console are Google Sign-In being blocked in automation —
  **ignore them**, they're unrelated to the feature under test.
- Kick off long `ollama pull` downloads in the background; don't block on them.
