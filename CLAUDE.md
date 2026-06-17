# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FinGuide is a Hebrew RTL platform for analyzing Israeli payslips (תלושי שכר). Monorepo with two workspaces:

- `backend/` — Node.js + Express + Mongoose API (CommonJS, server on `:5000`)
- `frontend/` — React 19 + Vite + TypeScript SPA (ESM, dev server on `:5173`)

Root `package.json` orchestrates both via `concurrently`. MongoDB is an external dependency (local, Atlas, or Docker). Hebrew is the user-facing language throughout — UI copy and error strings are in Hebrew on purpose; don't translate.

## Commands

Run from repo root unless noted.

```bash
npm run install:all       # install root + backend + frontend deps (first time)
npm run dev               # backend (nodemon :5000) + frontend (vite :5173) concurrently
npm run dev:backend
npm run dev:frontend
npm run dev:docker        # docker compose up --build — mongo + backend with OCR tools, backend host port becomes 5001
npm run lint              # lint backend + frontend
npm test                  # backend tests + frontend tests + frontend build (vite build runs as part of `test`)
```

Backend (`cd backend`):

```bash
npm run dev               # nodemon server.js
npm test                  # jest --runInBand (all tests, coverage on)
npm run test:unit         # __tests__/**/*.test.js + tests/unit/**
npm run test:integration  # tests/integration/**
npm run test:watch
npm run lint              # eslint .
npm run lint:fix
npm run format            # prettier --write
npx jest path/to/file.test.js                    # single file
npx jest -t "test name substring"                # single test by name
npm run debug:extractor:v2                       # run extraction-v2 ad-hoc on fixtures
npm run reprocess:payslips -- --only-missing-rates --limit 50 --write
```

Frontend (`cd frontend`):

```bash
npm run dev               # vite
npm run build             # tsc -b && vite build
npm test                  # jest (jsdom, ts-jest); --passWithNoTests
npm run lint              # eslint .
npx jest path/to/file.test.ts                    # single test file
```

`npm test` at the **root** also runs `vite build`. TypeScript compile errors fail CI even when no test asserts them.

## Environment Variables

Backend `.env` (validated at startup in `server.js` — missing/weak values crash the boot):

- `JWT_SECRET` — must be ≥10 chars
- `MONGODB_URI` — required
- `PORT` (default 5000; on `EADDRINUSE` server tries up to 10 sequential ports)
- `CLIENT_URL`, `GOOGLE_CLIENT_ID`, `JWT_EXPIRE`, `MAX_UPLOAD_SIZE_MB` (default 10MB)
- `OLLAMA_URL`, `OLLAMA_MODEL` — AI assistant LLM fallback
- SMTP (`SMTP_*`, `PASSWORD_RESET_EXPIRE_MINUTES`) for password reset
- Findings tuning knobs — full table in `README.md` (`CONTRIBUTION_RATE_*`, `DEPOSIT_CONTINUITY_*`, `PENSION_*`, `STUDY_FUND_*`)

Frontend `.env`: `VITE_GOOGLE_CLIENT_ID` (must match backend `GOOGLE_CLIENT_ID`), `VITE_API_URL`.

Vite dev server proxies `/api` and `/uploads` → `127.0.0.1:5000` (hard-coded in `frontend/vite.config.ts`). When `dev:docker` is used, backend is on host port **5001** — update the proxy or use an explicit `VITE_API_URL`.

## Architecture

### Backend layering (`backend/`)

```
routes/ → controllers/ → services/ + utils/ → models/ (Mongoose)
                              ↓
                       serializers/ (strip raw OCR text before sending)
```

- `server.js` validates env, connects DB, retries port on `EADDRINUSE`
- `app.js` wires middleware order: rate-limit (2000 req/15min in dev, 100 in prod) → CORS whitelist → JSON body → static `/uploads/profile-images` only → routes → 404 → `errorHandler`
- `middleware/errorHandler.js` maps Mongoose/JWT/Multer errors and custom `AppError` subclasses (in `utils/appErrors.js`) to typed JSON responses
- All non-auth routes go through `middleware/auth.js → protect` which attaches `req.user`

### Document processing pipeline (the core value chain)

`POST /api/documents/upload` runs **synchronously** inside `documentController.uploadDocument`:

1. Multer (`middleware/upload.js`) — **PDF only**, ≤ `MAX_UPLOAD_SIZE_MB` (default 10 MB), stored at `backend/uploads/{uuid}.pdf`
2. `Document.create({ status: 'pending' })`
3. `services/payslipOcr.extractPayslipFile`:
   - try `pdf-parse`; if text ≥ 200 chars with intact Hebrew → use directly
   - else fall back to `pdftoppm` → PNG → `sharp` → `tesseract heb+eng` with PSM 6/4/3 candidates, ranked by `services/payslipOcrResolver.rankExtractionCandidates`
4. `extractPayslipFinancialEN` builds the canonical `analysisData` object (`schema_version: '1.9'`) with `period`, `salary`, `deductions`, `contributions`, `tax`, `parties`, `employment`, `summary`, `raw`
5. `applyExtractorV2Shadow` runs `services/extraction-v2/` in **shadow mode** — writes results to `analysisData.extraction_v2` + `quality.validation` without replacing the legacy shape the UI reads
6. Status flips to `completed` (or `failed` with `processingError`)

`services/documentProcessingService.processDocumentAsync` exists and is tested but is **not wired into upload** — the controller does the work synchronously. Don't assume async processing runs.

OCR depends on `tesseract` + `poppler-utils` system binaries. Without them, the PDF fallback fails with a clear `ENOENT` message. `backend/Dockerfile` ships them — `dev:docker` is the easiest way to develop OCR-touching code on macOS.

### `analysisData` — the contract between backend and frontend

There are **no migrations** — `analysisData` schema evolves via a `schema_version` field on the document itself. Use `npm run reprocess:payslips` to backfill.

- DB stores the full canonical shape under `Document.analysisData` (Mongoose `Object`, intentionally schema-less)
- `serializers/documentSerializer.js` strips `raw.rawText`, `raw.ocr_text`, `quality.debug` before sending
- `frontend/src/utils/documentToPayslip.ts` maps `analysisData` → UI types (`PayslipHistoryItem`, `PayslipDetail`). **Single mapping layer** — if you rename a backend field, update this file
- A document is "valid for display" only when `status === 'completed'` && `analysisData` is an object
- Frontend never reads OCR-internal `summary` directly — it goes through `documentToPayslip`

### Findings system (`backend/utils/detect*.js`)

`findingsController` combines metadata heuristics (no documents, duplicates, stale, future-dated, missing metadata) with per-payslip analyzers:

- `detectFundWithoutDeposit.js` — pension / study fund declared but no deposit, cross-checked against `User.onboarding`
- `detectContributionRateGap.js` — declared vs. implied (amount ÷ base) percent, with min thresholds from `config/contributionRateThresholds.js`
- `detectDepositContinuityGap.js` — timeline gaps via shared `utils/contributionTimeline.js` + `utils/payslipPeriod.js`, configured by `config/depositContinuityConfig.js`
- `detectSalaryAnomalies.js` — month-over-month anomalies (used by AI, not currently surfaced as findings)

`GET /api/findings` returns optional `meta: { fundType, periods, documentIds, findingKind }` so the UI can deep-link to payslip history with `?highlight=YYYY-MM,...`.

### Savings forecast

`POST /api/findings/savings-forecast` → `services/savingsForecastService.js` + `utils/linearSavingsForecast.js`. Pure linear model: `currentBalance + monthlyContribution × monthsToRetirement` — **no interest, no inflation**. Returns two scenarios (current vs. adjusted) and a `meta.contributionSource: "document" | "manual"`. If neither a completed payslip with pension contributions nor an explicit `currentMonthlyContribution` is provided, it returns 400.

### AI assistant (`POST /api/ai/chat`)

Hybrid:

1. `aiController.buildUserContext` always loads completed payslips from DB — **the client's `userData` is ignored** (security)
2. `detectIntent` → if intent matches (e.g., what-if, salary anomalies), answer via deterministic rules (`utils/simulateWhatIf.js`, `utils/detectSalaryAnomalies.js`) — response `source: "rule"`
3. Otherwise call Ollama via `services/aiService.askLLM` with `buildFinancialSystemPrompt` — `source: "llm"`
4. `polishHebrewAnswer` post-processes

`LLM_SERVICE_INTEGRATION_GUIDE.md` documents an unrelated external Nginx proxy setup — **not used by the app**. The app talks to `OLLAMA_URL` directly.

### Frontend (`frontend/src/`)

Entry: `main.tsx` → `BrowserRouter` → `AuthProvider` → `App`.

Route tree (`App.tsx`):

- Public (wrapped in `RequireGuest`): `/`, `/login`, `/register`. `/reset-password` is open
- All other routes wrapped in `RequireAuth`
- `/onboarding` requires auth but is **not** gated by `onboarding.completed` — users can reach the dashboard before finishing onboarding

API clients in `frontend/src/api/`. `client.ts` reads JWT from `localStorage` and sets `Authorization: Bearer`. `AuthProvider` calls `getMe()` on mount to hydrate the session.

### Models

- `User` — `email` unique, `password` `select: false` with bcrypt `pre('save')` hash, `googleId` sparse unique, `onboarding: { completed, completedAt, data, updatedAt }`, password reset token fields
- `Document` — `user` (indexed), file fields, `metadata` (category, periodMonth/Year), `checksumSha256`, `status` (`uploaded` | `pending` | `processing` | `completed` | `failed`), `analysisData: Object` (schema-less for evolution), `processingError`

## Project Conventions

- **Hebrew + RTL throughout.** User-facing strings (errors, UI copy) are Hebrew on purpose — don't translate them.
- **Field names are English snake_case** in `analysisData` (e.g., `gross_total`, `net_payable`, `employment_start_date`). Frontend converts to camelCase via `documentToPayslip.ts`.
- **No structured logging / metrics / tracing** — `console.error` / `console.warn` only.
- **File uploads are local filesystem** (`backend/uploads/`), not S3. Downloads protect against path traversal by checking `resolvedPath.startsWith(uploadsDir)`.
- **Rate limit is 2000/15min in dev**, 100/15min in prod — `npm test` and local load testing won't trip it.
- **Backend is CommonJS** (`require`), frontend is ESM + TypeScript.
- **`backend/routes/dev.js` is not mounted** in `app.js` — don't assume dev-only endpoints are reachable.
- **`finguide-monorepo: file:..`** appears in both subpackages' `dependencies` — intentional npm workspaces-lite. Means root `npm install` must run before child installs (handled by `install:all`).

## Key Files for Orientation

When starting on an unfamiliar area:

| Task | Start here |
|------|-----------|
| Request lifecycle | `backend/app.js`, `backend/middleware/errorHandler.js`, `backend/utils/appErrors.js` |
| Upload + OCR | `backend/controllers/documentController.js` → `backend/services/payslipOcr.js` |
| OCR helpers | `backend/services/payslipOcr*.js` (label map, parties, contributions, resolver, numbers) |
| extraction-v2 (shadow) | `backend/services/extraction-v2/extraction.service.js`, `contracts/extractionResult.contract.js` |
| Findings logic | `backend/controllers/findingsController.js`, `backend/utils/detect*.js` |
| Savings forecast | `backend/services/savingsForecastService.js`, `backend/utils/linearSavingsForecast.js` |
| AI assistant | `backend/controllers/aiController.js`, `backend/services/aiService.js` |
| AI multi-agent orchestrator | `backend/ai/` → see `docs/MODULES_AND_AGENTS.md` §2 |
| New API domains + models | `docs/MODULES_AND_AGENTS.md` (pension, insurance, dashboard, insights, etc. + 8 new models) |
| Payslip UI shape | `frontend/src/utils/documentToPayslip.ts` |
| Auth wiring | `backend/middleware/auth.js`, `frontend/src/auth/AuthProvider.tsx`, `frontend/src/api/client.ts` |
| Architecture reference | `docs/ARCHITECTURE_DEEP_DIVE.md` (5 original domains) + `docs/MODULES_AND_AGENTS.md` (new domains + AI agents); `docs/FRONTEND-BACKEND-ROADMAP.md` is stale |
