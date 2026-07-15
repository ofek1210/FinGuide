# FinGuide — מיפוי באקנד מלא ומדריך מערכת הסוכנים (AI Agents)

> מסמך זה נוצר מקריאת הקוד בפועל (יולי 2026). הוא ממפה את **כל הבאקנד** עם דגש עמוק על
> **שלוש מערכות ה-AI/סוכנים** שקיימות בפרויקט. משלים את
> [`ARCHITECTURE_DEEP_DIVE.md`](./ARCHITECTURE_DEEP_DIVE.md) ואת
> [`MODULES_AND_AGENTS.md`](./MODULES_AND_AGENTS.md).

---

## תוכן עניינים

1. [תמונת-על של הבאקנד](#1-תמונת-על-של-הבאקנד)
2. [מפת Routes מלאה](#2-מפת-routes-מלאה)
3. [צינור עיבוד המסמכים (OCR)](#3-צינור-עיבוד-המסמכים-ocr)
4. [**מערכת הסוכנים — שלוש תתי-מערכות**](#4-מערכת-הסוכנים--שלוש-תתי-מערכות)
5. [מערכת A: מנוע הניתוח הרב-סוכני (`backend/ai/`)](#5-מערכת-a-מנוע-הניתוח-הרב-סוכני-backendai)
6. [מערכת B: סוכני הצ'אט המתמחים + RAG (`backend/services/agents/`)](#6-מערכת-b-סוכני-הצאט-המתמחים--rag-backendservicesagents)
7. [מערכת C: צ'אט היברידי (`aiController`)](#7-מערכת-c-צאט-היברידי-aicontroller)
8. [תצורת ספקי LLM](#8-תצורת-ספקי-llm)
9. [מודלים (DB) רלוונטיים לסוכנים](#9-מודלים-db-רלוונטיים-לסוכנים)
10. [שירותי דומיין שהסוכנים נשענים עליהם](#10-שירותי-דומיין-שהסוכנים-נשענים-עליהם)
11. [חיבורי Frontend](#11-חיבורי-frontend)
12. [איך מוסיפים סוכן חדש](#12-איך-מוסיפים-סוכן-חדש)

---

## 1. תמונת-על של הבאקנד

Node.js + Express + Mongoose (CommonJS), שרת על פורט `:5000`.

```
routes/  →  controllers/  →  services/ + utils/  →  models/ (Mongoose)
                                  ↓
                          serializers/  (מסננים raw OCR לפני שליחה ללקוח)

backend/ai/                ←  מנוע הניתוח הרב-סוכני (מערכת A)
backend/services/agents/   ←  סוכני צ'אט מתמחים + orchestrator (מערכת B)
backend/services/embeddings/ ← שכבת RAG (embedding + vector store + knowledge base)
```

- `server.js` — ולידציית env (קורס אם `JWT_SECRET` < 10 תווים או `MONGODB_URI` חסר), חיבור DB, retry על `EADDRINUSE`.
- `app.js` — סדר middleware: rate-limit (2000/15min בפיתוח, 100 בפרוד) → CORS whitelist → JSON body → static `/uploads/profile-images` → routes → 404 → `errorHandler`.
- `middleware/auth.js → protect` — כל ה-routes חוץ מ-auth ציבורי עוברים דרכו; מצמיד `req.user`.
- `middleware/errorHandler.js` — ממפה שגיאות Mongoose/JWT/Multer ו-`AppError` (מ-`utils/appErrors.js`) לתשובות JSON טיפוסיות.
- אין structured logging — `console.error`/`console.warn` בלבד.

---

## 2. מפת Routes מלאה

כל ה-prefixes ממופים ב-[`backend/app.js`](../backend/app.js). כולם מוגנים ב-`protect` למעט נתיבי auth ציבוריים.

| Prefix | עיקרי הנתיבים | Controller | תפקיד |
|--------|---------------|------------|-------|
| `/api/auth` | register, login, google, forgot/reset-password, me, change-password, profile/image | `authController` | הרשמה, התחברות (כולל Google OAuth), איפוס סיסמה, תמונת פרופיל |
| `/api/documents` | upload, list, `:id`, payslip-history, recent-payslips, `:id/download`, `:id/digest`, `:id/reprocess`, `:id/unlock`, `:id/fields` (PATCH), ai-insights | `documentController` | העלאת תלושים, OCR, ניהול מסמכים |
| `/api/ai` | **chat, chat/stream (SSE), chat/history, chat/conversations, financial-tips, full-analysis** | `aiController`, `fullAnalysisController` | צ'אט היברידי (מערכת C) + מנוע רב-סוכני (מערכת A) |
| `/api/agents` | **ask, list, embed, rag/stats, rag/index** | `agentController` | סוכני צ'אט מתמחים + RAG (מערכת B) |
| `/api/findings` | GET `/`, POST savings-forecast | `findingsController` | ממצאים (הפרשות חסרות, פערי רצף) + תחזית חיסכון ליניארית |
| `/api/onboarding` | GET/PUT `/`, complete, status | `onboardingController` | אשף הצטרפות; `complete` מפעיל insightsEngine ברקע |
| `/api/profile` | GET/PATCH `/` | `profileController` | `UserProfile`; עדכון מרענן המלצות ביטוח ברקע |
| `/api/insights` | GET `/`, run, `:id/dismiss` | `insightsController` | תובנות תלושים (`insightsEngine`) |
| `/api/recommendations` | GET `/`, run, `:id/dismiss`, `:id/purchased` | `recommendationsController` | המלצות ביטוח (`insuranceRecommender`) |
| `/api/notifications` | GET `/`, read-all, `:id/read`, DELETE `:id` | `notificationsController` | התראות |
| `/api/integrations/gmail` | status, connect, sync, disconnect | `gmailIntegrationController` | ייבוא תלושים מ-Gmail (OAuth, טוקנים מוצפנים) |
| `/api/tax-assistant` | summary?year= | `taxAssistantController` | מוכנות מס שנתית (`taxAssistantService`) |
| `/api/financial-health` | score?year= | `financialHealthController` | ציון בריאות 0–100 (`financialHealthScoreService`) |
| `/api/copilot` | analysis, problems, profile, goals, monthly-report | `copilotController` | תמונת-על פיננסית + יעדים + דוח חודשי (Claude/fallback) |
| `/api/score-agent` | gaps, answer | `scoreAgentController` | "סוכן ציון" אינטראקטיבי — פערי נתונים שחוסמים ציון מלא (rule-based, בלי LLM) |
| `/api/pension` | analysis, simulate, upload-file, funds CRUD, fund-advice, risk-advice, import-history | `pensionController` | פנסיה: ניתוח, ייבוא הר הכסף, סימולציות |
| `/api/insurance` | analysis, policies, upload-excel, market-advice, profile-insights, import-history | `insuranceController` | ביטוח: ייבוא הר הביטוח, כפילויות, השוואת שוק |
| `/api/dashboard` | summary | `dashboardController` | אגרגציה קלה לדשבורד (`demo=true` → mock) |
| `/api/summary-email` | send, whatsapp-url | inline | שליחת סיכום במייל / קישור WhatsApp |

> `backend/routes/dev.js` קיים אך **לא ממופה** ב-`app.js`.

---

## 3. צינור עיבוד המסמכים (OCR)

הליבה שממנה כל הסוכנים ניזונים. `POST /api/documents/upload` רץ **סינכרונית**:

1. Multer (`middleware/upload.js`) — PDF בלבד, ≤10MB, נשמר ב-`backend/uploads/{uuid}.pdf`.
2. `Document.create({ status: 'pending' })`.
3. `services/payslipOcr.extractPayslipFile` — `pdf-parse`; אם הטקסט קצר/פגום → fallback ל-`pdftoppm` → `sharp` → `tesseract heb+eng` (PSM 6/4/3, מדורג ע"י `payslipOcrResolver`).
4. בניית `analysisData` קנוני (`schema_version: '1.9'`): `period`, `salary`, `deductions`, `contributions`, `tax`, `parties`, `employment`, `summary`, `raw`.
5. פורמטים ייעודיים (למשל תלושי צה"ל) מזוהים דרך `payslipFormatProfiles.js` ומקבלים חילוץ מותאם.
6. סטטוס → `completed` / `failed`.

**כל הסוכנים קוראים את `analysisData.summary`** (שדות כמו `grossSalary`, `netSalary`, `pensionEmployee`...) — לעולם לא את ה-OCR הגולמי.

---

## 4. מערכת הסוכנים — שלוש תתי-מערכות

בפרויקט קיימות **שלוש מערכות AI נפרדות** שקל לבלבל ביניהן:

| # | מערכת | מיקום | נקודת כניסה | מטרה | סגנון |
|---|--------|-------|--------------|-------|--------|
| **A** | מנוע ניתוח רב-סוכני | `backend/ai/` | `POST /api/ai/full-analysis` | דוח ניתוח מלא: 5 סוכני דומיין רצים **במקביל** ומחזירים DTO מובנה | Pipeline דטרמיניסטי + LLM לניסוח בלבד |
| **B** | סוכני צ'אט מתמחים + RAG | `backend/services/agents/` | `POST /api/agents/ask` | שאלות-תשובות: סיווג כוונה → ניתוב לסוכן מומחה → תשובת LLM עם הקשר RAG | Router של שיחה, LLM במרכז |
| **C** | צ'אט היברידי | `controllers/aiController.js` | `POST /api/ai/chat` (+`/stream`) | הצ'אט הראשי ב-UI: intent rules דטרמיניסטיים, אחרת Claude/Ollama | Rule-first, LLM fallback |

הבחנה חשובה נוספת: קיימות **שתי פונקציות בשם `runFullAnalysis`** —
`ai/agents/orchestratorAgent.runFullAnalysis` (מערכת A) ו-`services/insightsEngine.runFullAnalysis`
(מנוע תובנות התלושים של `/api/insights` ו-onboarding). אין ביניהן קשר.

---

## 5. מערכת A: מנוע הניתוח הרב-סוכני (`backend/ai/`)

### 5.1 מבנה התיקייה

```
backend/ai/
├── agents/
│   ├── orchestratorAgent.js    # runFullAnalysis — המתזמר הראשי
│   ├── payslipAgent.js         # runPayslipAgent — שכר
│   ├── insuranceAgent.js       # runInsuranceAgent — ביטוח
│   ├── pensionAgent.js         # runPensionAgent — פנסיה
│   ├── financialProfileAgent.js# runFinancialProfileAgent — פרופיל (ללא LLM)
│   └── explanationAgent.js     # generateHebSummary — סיכום עברית / fallback
├── engines/
│   ├── ruleEngine.js           # שכבה 1: כללים דטרמיניסטיים (בלי LLM, בלי DB)
│   └── calculationEngine.js    # שכבה 2: חישובים פיננסיים (FV, אנונה, מגמות)
├── tools/
│   ├── payslipTools.js         # getPayslipSummaries / analyzeSalary / generateRecommendations
│   ├── pensionTools.js         # getPensionSummary / projectRetirementIncome / recommendations
│   ├── insuranceTools.js       # getInsuranceProfile / analyzeCoverage / recommendations
│   └── profileTools.js         # getFinancialProfile / calculateRiskProfile / detectPriorities
├── prompts/                    # system prompts לכל סוכן + orchestrator (עברית)
├── services/
│   ├── parallelAnalysisService.js  # מעטפת כניסה + sanitization של הפלט
│   ├── executionCanvasService.js   # "קנבס עבודה" — תכנית משימות לפני הריצה
│   ├── govDataPrefetchService.js   # חימום cache של data.gov.il
│   └── actionItemsBuilder.js       # מיזוג פלטים ל-action items ממוינים ל-UI
└── mock/mockData.js            # MOCK_FULL_ANALYSIS_RESULT — מצב demo
```

### 5.2 זרימת הריצה המלאה

```
POST /api/ai/full-analysis   body: { focus?, skipLLM?, refreshGovData?, demo? }
  → fullAnalysisController.runFullAnalysisHandler     (demo=true → mock מיידי)
  → parallelAnalysisService.runParallelAnalysis       (ולידציית focus, sanitization)
  → orchestratorAgent.runFullAnalysis(userId, opts):

  ┌─ שלב 0: Execution Canvas ──────────────────────────────────────────┐
  │ buildExecutionCanvas — סופר במקביל: תלושים (Document), פוליסות     │
  │ (InsurancePolicy), קרנות (PensionFund) + UserProfile.              │
  │ לכל דומיין: priority, dataAvailable, ורשימת משימות בעברית         │
  │ (למשל: "בדיקת חובת תיאום מס (2 מעסיקים)" אם hasMultipleEmployers). │
  └────────────────────────────────────────────────────────────────────┘
  ┌─ שלב 0.5 (במקביל): Gov prefetch + ציון גלובלי ─────────────────────┐
  │ prefetchGovMarketData — מחמם cache של פנסיה-נט + מדד השירות        │
  │ (data.gov.il); buildFinancialHealthScore(userId, year).            │
  └────────────────────────────────────────────────────────────────────┘
  ┌─ שלב 1: 5 סוכני דומיין במקביל (Promise.allSettled) ────────────────┐
  │ payslip · insurance · pension · gemel · profile                            │
  │ focus יכול לדלג: 'pension' → רק pension רץ, וכו'.                  │
  │ סוכן שנכשל → { status: 'error' }, השאר ממשיכים.                    │
  └────────────────────────────────────────────────────────────────────┘
  ┌─ שלב 2: מיזוג ──────────────────────────────────────────────────────┐
  │ mergeRecommendations — dedup לפי type, מיון urgency (high→low).    │
  │ buildActionItems — עד 8 פריטים ממוינים: פסקי דין פנסיה/ביטוח,      │
  │ כפל ביטוחי, המלצות דחופות, topActions מהציון, פערי נתונים מהקנבס. │
  └────────────────────────────────────────────────────────────────────┘
  ┌─ שלב 3: סיכום LLM ─────────────────────────────────────────────────┐
  │ buildSafeContext → orchestratorPrompt → askClaude.                 │
  │ נכשל / skipLLM / אין ANTHROPIC_API_KEY →                           │
  │ explanationAgent.generateHebSummary (rule fallback).               │
  │ summarySource ∈ 'claude' | 'rule' | 'fallback'.                    │
  └────────────────────────────────────────────────────────────────────┘
  ┌─ שלב 4: לוג ────────────────────────────────────────────────────────┐
  │ AgentRunLog.create — runId, agentsRan, statuses, durationMs,       │
  │ summarySource. TTL אוטומטי 90 יום. כשל בלוג אינו קוטל את הריצה.    │
  └────────────────────────────────────────────────────────────────────┘
```

### 5.3 חוזה הסוכן (Agent Contract)

כל `runXAgent(userId, { skipLLM })` מחזיר את אותו DTO:

```js
{
  agentId: 'payslip' | 'insurance' | 'pension' | 'profile',
  status: 'success' | 'no_data' | 'error',
  message?: string,          // הודעת עברית במצב no_data
  data: object | null,       // DTO ייעודי לדומיין — לעולם לא מסמך Mongoose
  recommendations: [{ type, title, reason, urgency, financialImpact?, confidenceScore }],
  llmExplanation: string | null,   // ניסוח Claude, אופציונלי
  durationMs: number,
}
```

### 5.4 מה כל סוכן עושה

| סוכן | Pipeline | data עיקרי | LLM |
|------|----------|-------------|-----|
| **payslip** | `getPayslipSummaries` (עד 6 תלושים אחרונים) → `analyzeSalary` (מגמה + חריגות) → `generatePayslipRecommendations` | מגמת שכר, חריגות, ברוטו/נטו אחרונים | הסבר 3–4 משפטים |
| **pension** | `pensionAnalysisService.buildPensionAnalysis` (summary, projection, benchmark מול data.gov.il, healthCheck, fundAdvice) | תחזית פרישה, פסק דין לכל קרן: **LEAVE / NEGOTIATE / SWITCH**, חיסכון דמי ניהול | ניתוח אקטוארי 4–5 משפטים |
| **insurance** | `insuranceAnalysisService.buildInsuranceAnalysis` (אגרגציה, כפילויות, כיסוי חסר, marketAdvice) | בזבוז חודשי, פסק דין: **STAY / REVIEW / SWITCH**, מטריצת עלות/שירות | ניתוח 4–5 משפטים |
| **profile** | `getFinancialProfile` → `calculateRiskProfile` (ניקוד לפי גיל/סיכון/משכנתא/ילדים → הקצאת נכסים) → `detectFinancialPriorities` | פרופיל סיכון, שלמות מסמכים, עדיפויות (upload_payslip, set_goals...) | **אין** — דטרמיניסטי לגמרי |

דוגמאות המלצות שה-payslip agent מייצר: `pension_low` (הפרשה < 6%, urgency high),
`salary_anomaly`, `missing_training_fund`.

### 5.5 המנועים (Engines) — הסטאק ההיברידי

עקרון הארכיטקטורה: **המספרים תמיד דטרמיניסטיים; ה-LLM רק מנסח.**

- **`ruleEngine.js` (שכבה 1)** — כללים טהורים: חריגות שכר, שיעור פנסיה מול מינימום 6%,
  פערי OCR בפנסיה, כפל ביטוחי (הפוליסה הזולה = keeper, השאר waste), כיסוי חסר לפי פרופיל,
  שלמות מסמכים. אסור לו לגשת ל-MongoDB.
- **`calculationEngine.js` (שכבה 2)** — חישובים: `projectPensionIncome` (FV של צבירה + אנונה,
  drawdown של 240 חודשים, תרחיש בסיסי 5.5% + אופטימי 7%), `calculateMgmtFeeSavings`,
  `calculateSalaryTrend`, `calculateQuickHealthScore`, `estimateInsuranceSavings`.
  קבועים ב-`PENSION_DEFAULTS` (תשואה 5.5%, אינפלציה 2.5%, יעד תחלופה 70%).

### 5.6 אינווריאנטות אבטחה

1. ה-orchestrator **לא ניגש ל-MongoDB ישירות** — רק דרך tools/services.
2. **מסמכי DB גולמיים לא נשלחים ל-LLM.** `buildSafeContext` מצמצם כל סוכן ל-
   `{ status, data, recommendationCount, topRecommendation, verdict }` לפני הפרומפט.
3. כל tool מחזיר DTO שטוח — לעולם לא מסמך Mongoose (`lean()` + מיפוי ידני).
4. כשל של סוכן בודד לא מפיל את הריצה (`Promise.allSettled`).
5. כשל LLM שקוף — תמיד יש rule fallback; המשתמש מקבל תשובה בכל מקרה.

---

## 6. מערכת B: סוכני הצ'אט המתמחים + RAG (`backend/services/agents/`)

מערכת **שיחה** (לא ניתוח): המשתמש שואל שאלה חופשית ← orchestrator מסווג כוונה ← מנתב
לסוכן מומחה ← הסוכן עונה עם LLM + הקשר RAG.

### 6.1 מבנה

```
backend/services/agents/
├── baseAgent.js               # מחלקת BaseAgent + getClient (Anthropic) + callOllama
├── orchestrator.js            # classifyIntent + orchestrate — הניתוב
├── payslipAgent.js            # 'payslip_analysis'  — הסבר תלוש
├── pensionAgent.js            # 'pension_advisor'   — ייעוץ פנסיוני
├── financialAnalysisAgent.js  # 'financial_analysis'— מגמות וחריגות
├── financialPlanningAgent.js  # 'financial_planning'— תקציב/חיסכון/פרישה (50/30/20)
├── insuranceAgent.js          # 'insurance_benefits'— המלצות ביטוח
└── index.js                   # exports

backend/services/embeddings/   # שכבת ה-RAG
├── embeddingService.js        # Ollama `all-minilm` (env: EMBEDDING_MODEL) + cosine similarity
├── vectorStore.js             # vector store מבוסס JSON מקומי (מספיק ל-<1000 chunks)
├── documentChunker.js         # chunkPayslipAnalysis / chunkKnowledgeArticle
├── knowledgeBase.js           # מאמרי ידע פיננסי ישראלי מובנים בקוד
└── ragService.js              # indexKnowledgeBase / indexPayslipDocument / retrieveContext
```

### 6.2 זרימת בקשה

```
POST /api/agents/ask   body: { message, conversationHistory? }
  → agentController.askAgent
      1. buildAgentUserContext(userId)
         — עד 50 מסמכים completed/needs_review → 3 תלושים אחרונים → DTO שטוח
           (ברוטו, נטו, ניכויים, הפרשות, רכיבי שכר, היסטוריה)
         — + UserProfile + 5 Insights פעילים + 5 Recommendations פעילות
      2. orchestrate(message, { userContext, history, userId })
         a. classifyIntent:
            • שכבת כללים — מילות מפתח בעברית/אנגלית ("תלוש"→payslip_analysis,
              "פנסיה"/"קרן השתלמות"→pension_advisor, "ביטוח"→insurance_benefits,
              "תכנון"/"חיסכון"/"פרישה"→financial_planning, "מגמה"/"חריגה"→financial_analysis)
            • אם אין התאמה → סיווג LLM (Claude, temperature 0, max_tokens 50)
            • אם אין Claude → סיווג Ollama → אחרת 'general'
         b. התאמה לסוכן → agent.run(query, context)
         c. 'general' → ה-orchestrator עונה בעצמו + RAG (topK 3)
      3. תשובה: { answer, agent, classification, sources[], model, tokensUsed }
```

### 6.3 `BaseAgent.run()` — מה כל סוכן מתמחה עושה

כל סוכן מומחה הוא subclass של `BaseAgent` שמגדיר רק: `name`, `description`,
`systemPrompt` (עברית, עם כללים כמו "אל תמציא", דיסקליימר חובה), `ragCategory`,
ולעיתים override ל-`formatUserContext` (למשל payslipAgent מפרמט תלוש מלא + היסטוריה).

`run()` המשותף:

1. `retrieveContext(query, { userId, category, topK: 4 })` — חיפוש בו-זמני במאגר הידע
   (60% מה-topK, minScore 0.3) ובמסמכי המשתמש (40%, minScore 0.25, מסונן לפי userId).
2. בניית system prompt מלא: prompt הסוכן + הקשר RAG + נתוני משתמש + כללי תשובה
   (עברית, דיסקליימר "⚠️ מידע זה הוא לצורכי לימוד בלבד...").
3. קריאת LLM: **Claude קודם** (`CHAT_MODEL`, max_tokens 1200, temp 0.3, 6 הודעות
   היסטוריה אחרונות ×1500 תווים) → **Ollama fallback** (system prompt מקוצץ ל-2000
   תווים, timeout 30s) → הודעת שגיאה בעברית.

### 6.4 ה-RAG בפירוט

- **Embeddings**: Ollama `all-minilm` (החלטה מכוונת — בלי שירות בתשלום). קלט מקוצץ ל-2000 תווים.
- **Vector store**: JSON מקומי עם cosine similarity — לא DB וקטורי אמיתי; מתאים לדמו.
  בפרודקשן מיועד להתחלף ב-MongoDB Atlas Vector Search.
- **אינדוקס**: `POST /api/agents/rag/index` מאנדקס את מאמרי `knowledgeBase.js`;
  `POST /api/agents/embed` מאנדקס תלוש ספציפי (chunks מ-`analysisData`).
- **חשוב**: האינדקס בזיכרון/קובץ — אם ה-store ריק, `retrieveContext` פשוט מחזיר הקשר ריק
  והסוכן עונה בלי RAG (degradation שקט).

---

## 7. מערכת C: צ'אט היברידי (`aiController`)

הצ'אט הראשי של ה-UI (`POST /api/ai/chat`, `/api/ai/chat/stream` ב-SSE):

1. `buildUserContext(userId)` — תמיד נטען מה-DB; **`userData` מהלקוח נזרק** (אבטחה).
2. `detectIntent(message)` — כוונות דטרמיניסטיות: what-if (סימולציית שכר דרך
   `utils/simulateWhatIf` — מדרגות מס, ביטוח לאומי, נקודות זיכוי), חריגות שכר
   (`utils/detectSalaryAnomalies`). התאמה → תשובת כלל, `source: 'rule'`, בלי LLM.
3. אחרת → `claudeChatService.chat/streamChat`:
   - `buildEnhancedSystemPrompt` — פרומפט עשיר: ידע כללי מוטמע (פנסיה, ביטוח, מדרגות
     מס 2026, משכנתאות), פרופיל, תלוש אחרון, תובנות והמלצות פעילות, ו-`pageContext`
     (המסך שהמשתמש צופה בו — לשאלות "מה זה?").
   - Claude (`CHAT_PROVIDER=claude` ברירת מחדל) → fallback ל-Ollama (`aiService.askLLM`).
4. הודעות נשמרות ב-`ChatMessage` (conversationId, role, content, metadata).
5. `GET /api/ai/financial-tips` — טיפים מותאמים (rule-based, שיפור Claude אופציונלי).

---

## 8. תצורת ספקי LLM

| משתנה env | ברירת מחדל | משמש את |
|-----------|------------|----------|
| `ANTHROPIC_API_KEY` | — | כל שלוש המערכות; בהיעדרו הכל נופל ל-Ollama / rules |
| `CHAT_PROVIDER` | `claude` | מערכת C (בחירת ספק ראשי) |
| `CHAT_MODEL` | `claude-sonnet-4-20250514` | כל קריאות Claude (A, B, C) |
| `OLLAMA_URL` | `http://localhost:11434` | fallback בכל המערכות + embeddings |
| `OLLAMA_MODEL` | `llama3.1:8b` | fallback צ'אט |
| `EMBEDDING_MODEL` | `all-minilm` | RAG (מערכת B) |

**מדרג נפילה אחיד בכל המערכות:** Claude → Ollama → rule-based / הודעת שגיאה בעברית.
המערכת פונקציונלית לחלוטין גם בלי אף LLM (המספרים דטרמיניסטיים; רק הניסוח נפגע).

---

## 9. מודלים (DB) רלוונטיים לסוכנים

| מודל | קולקציה | שדות עיקריים | מי משתמש |
|------|----------|----------------|-----------|
| `Document` | documents | `analysisData` (schema-less, `schema_version`), `status`, `metadata`, `checksumSha256` | כל הסוכנים (מקור האמת לתלושים) |
| `UserProfile` | userprofiles | personal / financial / assets / insurance / retirement / employment / goals[] | canvas, profile agent, ביטוח, צ'אט |
| `PensionFund` | pension_funds | fundName, fundType, currentBalance, דמי ניהול, tracks | pension agent, canvas |
| `InsurancePolicy` | insurance_policies | type, provider, monthlyPremium, coverage, status | insurance agent, canvas |
| `Insight` | insights | kind, severity, payload, status | הקשר צ'אט (מערכות B, C) |
| `Recommendation` | recommendations | kind, importance, reasoning[], priceRange | הקשר צ'אט |
| `ChatMessage` | chatmessages | conversationId, role, content ≤8000, metadata (intent, model, tokensUsed) | מערכת C |
| `AgentRunLog` | agent_run_logs | **runId (unique)**, agentsRan[], statuses (Map), totalRecommendations, durationMs, summarySource (claude/rule/fallback), **TTL 90 יום** | מערכת A (אודיט) |

---

## 10. שירותי דומיין שהסוכנים נשענים עליהם

| שירות | תפקיד | נצרך ע"י |
|-------|--------|-----------|
| `pensionAnalysisService.buildPensionAnalysis` | ניתוח פנסיה מלא: summary, projection, benchmark, healthCheck, fundAdvice | pension agent (A), `/api/pension/analysis` |
| `pensionGovDataService` / `insuranceGovDataService` | נתוני data.gov.il (פנסיה-נט, מדד שירות) עם cache + static fallback | gov prefetch, benchmarks |
| `pensionFundAdvisorService.buildFundAdvice` | פסק דין לכל קרן: LEAVE/NEGOTIATE/SWITCH + gainIfSwitch | pension agent |
| `insuranceAnalysisService.buildInsuranceAnalysis` | אגרגציה, כפילויות, כיסוי חסר, healthCheck | insurance agent (A), `/api/insurance/analysis` |
| `insuranceMarketAdvisorService.buildMarketAdvice` | מטריצת עלות/שירות מול השוק: STAY/REVIEW/SWITCH | insurance agent |
| `financialHealthScoreService.buildFinancialHealthScore` | ציון 0–100 ב-5 קטגוריות | orchestrator (A), `/api/financial-health` |
| `claudeChatService` | `askClaude` / `chat` / `streamChat` — שער יחיד ל-Anthropic API | כל המערכות |
| `insightsEngine` | תובנות תלושים (salary_drop, pension_low...) — **לא** חלק ממערכת A | `/api/insights`, onboarding |
| `harHaKesefService` / `insuranceExcelParser` | פרסור דוחות הר הכסף / הר הביטוח | ייבוא נתונים שהסוכנים קוראים |

---

## 11. חיבורי Frontend

| קובץ frontend | Endpoint | UI |
|---------------|----------|-----|
| `src/api/fullAnalysis.api.ts` | `POST /api/ai/full-analysis` | מסך הניתוח המלא (מערכת A) |
| `src/api/agents.api.ts` | `POST /api/agents/ask`, list, embed, rag/* | `AIAgentsPage.tsx` (מערכת B) |
| `src/api/ai.api.ts` | `POST /api/ai/chat`, `/chat/stream` (SSE), history, conversations | הצ'אט הראשי (מערכת C) |

---

## 12. איך מוסיפים סוכן חדש

### למערכת A (סוכן דומיין בניתוח המקבילי)

1. צור `backend/ai/tools/<domain>Tools.js` — פונקציות fetch (DTO בלבד, `lean()`),
   analyze (rules/calculations), recommendations.
2. צור `backend/ai/agents/<domain>Agent.js` שממלא את חוזה הסוכן (§5.3):
   `run<Domain>Agent(userId, { skipLLM })` → `{ agentId, status, data, recommendations, llmExplanation, durationMs }`.
3. הוסף prompt ב-`backend/ai/prompts/`.
4. חבר ב-`orchestratorAgent.js`: הוסף ל-`agentPromises`, עדכן את לוגיקת `focus`,
   ואת `buildExecutionCanvas` (דומיין + משימות) לפי הצורך.
5. אם יש verdicts — עדכן את `actionItemsBuilder.js`.
6. בדיקות: mock ל-tools, הרצה עם `skipLLM: true` (כל ה-tests רצים בלי LLM).

### למערכת B (סוכן צ'אט מתמחה)

1. צור subclass של `BaseAgent` עם `name`, `description`, `systemPrompt` בעברית,
   `ragCategory`, ו-override ל-`formatUserContext` אם צריך.
2. רשום אותו ב-`AGENTS` שב-`orchestrator.js` והוסף מילות מפתח ל-`classifyIntent`
   (גם לפרומפט הסיווג של ה-LLM).
3. אם צריך ידע חדש — הוסף מאמרים ל-`knowledgeBase.js` והרץ `POST /api/agents/rag/index`.

### כללי ברזל (בשתי המערכות)

- לעולם לא לשלוח מסמך Mongoose או OCR גולמי ל-LLM.
- כל פיצ'ר חייב לעבוד גם בלי `ANTHROPIC_API_KEY` (rule fallback).
- כל טקסט למשתמש — בעברית, כולל הודעות `no_data` ודיסקליימר ייעוץ.
