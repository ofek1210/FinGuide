# FinGuide — Modules & AI Agents Reference

מסמך זה משלים את [`ARCHITECTURE_DEEP_DIVE.md`](./ARCHITECTURE_DEEP_DIVE.md). ה-deep dive
מתעד לעומק את חמשת הדומיינים המקוריים (auth, documents, ai/chat, findings, onboarding).
מאז נוספו ל-`backend/app.js` **12 קבוצות routes נוספות**, **8 מודלים חדשים** ומערכת
**AI multi-agent**. מסמך זה מכסה את התוספות האלו בלבד — בלי לשכפל את ה-deep dive.

> נוצר מקריאת הקוד בפועל (לא roadmap). אם משנים endpoint/מודל — עדכן כאן.

---

## 1. מפת ה-Routes החדשים (משלים §3.2 ב-deep dive)

כולם מאחורי `protect` (JWT). מקור: [`backend/app.js`](../backend/app.js).

| Prefix | Method + Path | Handler | מה עושה |
|--------|---------------|---------|---------|
| `/api/profile` | GET `/` | `profileController.getProfile` | פרופיל מלא של המשתמש |
| | PATCH `/` | `profileController.updateProfile` | עדכון מקטעי פרופיל; מרענן המלצות ביטוח ברקע |
| `/api/insights` | GET `/` | `listInsights` | רשימת תובנות (סינון לפי status/severity) |
| | POST `/run` | `runAnalysis` | מריץ ניתוח מגמות תלושים → יוצר Insights |
| | POST `/:id/dismiss` | `dismissInsight` | סימון תובנה כנדחתה |
| `/api/recommendations` | GET `/` | `listRecommendations` | המלצות ביטוח/פנסיה פעילות |
| | POST `/run` | `runRecommendations` | הרצת כללי המלצה (insuranceRecommender) |
| | POST `/:id/dismiss` / `/:id/purchased` | — | סימון נדחתה / נרכשה |
| `/api/notifications` | GET `/` | `listNotifications` | התראות (אופציה `unreadOnly`) + ספירה |
| | POST `/read-all`, `/:id/read`, DELETE `/:id` | — | סימון נקרא / מחיקה |
| `/api/integrations/gmail` | GET `/status` | `getGmailStatus` | מצב חיבור, lastSyncAt, importedCount |
| | POST `/connect`, `/sync`, DELETE `/disconnect` | — | OAuth, ייבוא תלושים מ-Gmail, ניתוק |
| `/api/tax-assistant` | GET `/summary?year=` | `getTaxAssistantSummary` | סיכום מוכנות-מס שנתי + זיהוי בעיות |
| `/api/financial-health` | GET `/score?year=` | `getFinancialHealthScore` | ציון בריאות פיננסית 0–100 (5 קטגוריות) |
| `/api/copilot` | GET `/analysis` | `getCopilotAnalysis` | תמונת-על: פרופיל, תלוש אחרון, תקציב, השקעות, ציון, יעדים |
| | PUT `/profile`, POST/PUT `/goals`, DELETE `/goals/:id` | — | עדכון פרופיל פיננסי וניהול יעדים |
| | POST `/monthly-report` | `generateReport` | דוח חודשי markdown (Claude, fallback rule-based) |
| `/api/score-agent` | GET `/gaps` | `getGaps` | פערים בנתונים שחוסמים ציון מלא |
| | POST `/answer` | `submitAnswer` | מענה אינטראקטיבי למילוי פער |
| `/api/pension` | GET `/analysis` | `getPensionAnalysis` | ניתוח פנסיה מלא למשתמש |
| | POST `/simulate` | `simulateScenario` | what-if: `{ retirementAge, additionalContribution, targetMgmtFee }` |
| `/api/insurance` | GET `/analysis`, `/policies` | — | ניתוח AI מפרופיל+פוליסות; רשימת פוליסות |
| | POST `/upload-excel` | `uploadInsuranceExcel` | ייבוא Excel של "הר הביטוח" (memory multer, xlsx/xls ≤5MB) |
| | DELETE `/policies/:id` | `deleteInsurancePolicy` | מחיקת פוליסה |
| `/api/dashboard` | GET `/summary` | `getDashboardSummary` | אגרגציה: docs + profile + policies + recommendations (Promise.all) |

---

## 2. מערכת ה-AI Multi-Agent

זרימה זו **נפרדת** מצ'אט ה-AI שתועד ב-deep dive (§6.4). זהו מנוע ניתוח רב-סוכני.

### 2.1 נקודת כניסה וזרימה

```
POST /api/ai/full-analysis
  → fullAnalysisController.runFullAnalysisHandler
  → ai/services/parallelAnalysisService.runParallelAnalysis(userId, { focus, skipLLM })
  → ai/agents/orchestratorAgent.runFullAnalysis
```

[`orchestratorAgent.runFullAnalysis`](../backend/ai/agents/orchestratorAgent.js):

1. **מריץ 4 סוכני דומיין במקביל** (`Promise.allSettled`): `payslip`, `insurance`,
   `pension`, `profile`. פרמטר `focus` (`all`/`payslip`/`insurance`/`pension`) יכול
   לדלג על חלקם.
2. **ממזג המלצות** — `mergeRecommendations`: deduplication לפי `type`, מיון לפי
   `urgency` (`high` → `medium` → `low`).
3. **סיכום עברית** — אם `!skipLLM && ANTHROPIC_API_KEY`: `askClaude` עם
   `orchestratorPrompt`; אחרת fallback ל-`explanationAgent.generateHebSummary`
   (rule-based). `summarySource` ∈ `claude` | `rule` | `fallback`.
4. **לוג** — יוצר רשומת [`AgentRunLog`](../backend/models/AgentRunLog.js).

### 2.2 מבנה התיקייה `backend/ai/`

| תיקייה / קובץ | תפקיד |
|---------------|--------|
| `agents/orchestratorAgent.js` | מתזמר; `runFullAnalysis(userId, {skipLLM, focus})` |
| `agents/payslipAgent.js` | `runPayslipAgent` — ניתוח תלושים |
| `agents/insuranceAgent.js` | `runInsuranceAgent` — ניתוח ביטוח |
| `agents/pensionAgent.js` | `runPensionAgent` — ניתוח פנסיה |
| `agents/financialProfileAgent.js` | `runFinancialProfileAgent` — פרופיל פיננסי |
| `agents/explanationAgent.js` | `generateHebSummary` — סיכום עברית (rule fallback) |
| `engines/calculationEngine.js`, `ruleEngine.js` | חישובים וכללים דטרמיניסטיים |
| `tools/{payslip,insurance,pension,profile}Tools.js` | פונקציות עזר לכל דומיין |
| `prompts/*.js` | system prompts לכל סוכן + orchestrator |
| `services/parallelAnalysisService.js` | `runParallelAnalysis` — מעטפת + sanitization |

**חוזה סוכן:** כל `runXAgent(userId, opts)` מחזיר
`{ agentId, status, data, recommendations[], message?, durationMs?, llmExplanation? }`.

### 2.3 אינווריאנטות אבטחה (מתועדות בקוד ה-orchestrator)

- ה-orchestrator **לעולם לא** ניגש ל-MongoDB ישירות — רק דרך סוכני הדומיין.
- **לא** נשלחים מסמכי DB גולמיים ל-LLM. `buildSafeContext` מצמצם כל סוכן ל-
  `{ status, data, recommendationCount, topRecommendation }` לפני הפרומפט.
- כשל סוכן (`Promise.allSettled` rejected) → נרשם כ-`status: 'error'`, שאר הניתוח נמשך.

### 2.4 ספק ה-LLM (משלים את §6.4)

ה-deep dive ציין רק Ollama. בפועל ספק ברירת המחדל הוא **Claude (Anthropic)** —
[`services/claudeChatService.js`](../backend/services/claudeChatService.js):

| משתנה | ברירת מחדל | תפקיד |
|-------|-----------|-------|
| `CHAT_PROVIDER` | `claude` | בחירת ספק (`claude` / `ollama`) |
| `CHAT_MODEL` | `claude-sonnet-4-20250514` | מזהה מודל Claude |
| `ANTHROPIC_API_KEY` | — | חובה ל-Claude; בהיעדרו → נפילה ל-Ollama |
| `OLLAMA_URL`, `OLLAMA_MODEL` | `…`, `llama3.1:8b` | fallback מקומי |

צ'אט (נפרד מ-full-analysis): `POST /api/ai/chat`, `/chat/stream` (SSE),
`/chat/history`, `/chat/conversations`, `/financial-tips`. הודעות נשמרות ב-
[`ChatMessage`](../backend/models/ChatMessage.js).

> ⚠️ **שתי פונקציות בשם `runFullAnalysis`** — אל תבלבל:
> - [`ai/agents/orchestratorAgent`](../backend/ai/agents/orchestratorAgent.js) — המנוע הרב-סוכני (מסמך זה).
> - [`services/insightsEngine`](../backend/services/insightsEngine.js) — מנוע תובנות התלושים (משמש את `/api/insights` ו-onboarding).

---

## 3. מודלים חדשים (משלים §4 ב-deep dive)

ה-deep dive מתעד `User` ו-`Document`. להלן 8 המודלים הנוספים. כולם עם
`user: ObjectId → User` (indexed) ו-`timestamps`.

### 3.1 UserProfile ([`models/UserProfile.js`](../backend/models/UserProfile.js))
פרופיל אחד למשתמש, עם מקטעים מקוננים:
- **personal** — fullName, age, gender, occupation, maritalStatus, childrenCount/Ages, spouseWorks, isSmoker.
- **financial** — salaryRange, monthlyExpensesEstimate, savingsEstimate, monthlyDebts, riskTolerance.
- **assets** — ownsApartment, ownsCar, hasMortgage, mortgageMonthlyPayment.
- **insurance** — hasLife/Health/Disability/Apartment/CarInsurance.
- **retirement** — hasPension, hasStudyFund, …
- **employment** — salaryType, rates, jobPercentage וכו'.
- **goals[]** — `{ type, label, targetAmount, currentAmount, targetDate, priority }`.

### 3.2 PensionFund ([`models/PensionFund.js`](../backend/models/PensionFund.js)) · collection `pension_funds`
`fundName`, `fundType` (enum: pension_comprehensive/old, managers_insurance, provident_fund, study_fund, other), `provider`, `accountNumber` (**select:false**), `currentBalance`, `monthlyDeposit`, `employee/employerContributionRate`, `managementFeeAccumulation/Deposit`, `historicalReturn1Y/5Y`, `investmentTrack`, `isActive`, `sourceFile`.

### 3.3 InsurancePolicy ([`models/InsurancePolicy.js`](../backend/models/InsurancePolicy.js)) · collection `insurance_policies`
`type` (enum: life/health/disability/apartment/car/mortgage/critical_illness/other), `provider`, `policyNumber`, `monthly/annualPremium`, `coverageAmount`, `start/endDate`, `status` (active/expired/cancelled/unknown), `rawData` (**select:false** — נתוני ייבוא גולמיים), `notes`.

### 3.4 Insight ([`models/Insight.js`](../backend/models/Insight.js))
`kind` (8: salary_drop/growth, pension_low/missing, tax_anomaly, missing_payslip, unusual_deduction, study_fund_low), `severity` (info/warning/critical), `title`, `description`, `payload` (Mixed), `status` (active/dismissed/resolved), `dismissedAt`, `expiresAt`, `sourceDocumentIds[]`.

### 3.5 Recommendation ([`models/Recommendation.js`](../backend/models/Recommendation.js))
`kind` (life/health/disability/apartment/car/pension_increase), `importance` (critical/high/medium/low), `title`, `reasoning[]`, `priceRange` `{min, average, max, currency}`, `coverageEstimate`, `status` (active/dismissed/purchased), `lastEvaluatedAt`.

### 3.6 Notification ([`models/Notification.js`](../backend/models/Notification.js))
`type` (insight_created, recommendation_new, document_processed, salary_drop, missing_payslip, system), `title`, `body`, `link`, `read`, `readAt`, `sourceType` (insight/recommendation/document/null), `sourceId`. אינדקס `{user, read, createdAt:-1}`.

### 3.7 ChatMessage ([`models/ChatMessage.js`](../backend/models/ChatMessage.js))
`conversationId` (indexed), `role` (user/assistant/system), `content` (≤8000), `metadata` `{ intent, contextUsed[], tokensUsed, model }`.

### 3.8 AgentRunLog ([`models/AgentRunLog.js`](../backend/models/AgentRunLog.js)) · collection `agent_run_logs`
`runId` (**unique**), `agentsRan[]`, `statuses` (Map), `totalRecommendations`, `durationMs`, `summarySource` (claude/rule/fallback), `errorCount`. **TTL: רשומות נמחקות אוטומטית אחרי 90 יום.**

---

## 4. טבלת דומיין ↔ מודל ↔ שירות (משלים §10)

| Prefix | מודל ראשי | שירותים מרכזיים |
|--------|-----------|-----------------|
| `/api/profile`, `/api/copilot` | `UserProfile` | budgetAnalysisService, investmentRecommenderService, monthlyReportService |
| `/api/insights` | `Insight` | insightsEngine |
| `/api/recommendations` | `Recommendation` | insuranceRecommender, insurancePricingTables |
| `/api/notifications` | `Notification` | notificationService, digestService |
| `/api/integrations/gmail` | `User.gmailIntegration` (טוקנים מוצפנים) | gmailService, utils/tokenCrypto |
| `/api/tax-assistant` | `Document` (קריאה) | taxAssistantService, form106Service |
| `/api/financial-health` | מצרפי (read) | financialHealthScoreService |
| `/api/pension` | `PensionFund` | pensionController + ai/agents/pensionAgent |
| `/api/insurance` | `InsurancePolicy` | harHaBituachService, insurancePricingTables |
| `/api/score-agent` | מצרפי (read) | scoreGapService |
| `/api/ai/full-analysis` | `AgentRunLog` (לוג) | ai/services/parallelAnalysisService + 4 הסוכנים |

---

## 5. הפניות

- ארכיטקטורת ליבה: [`ARCHITECTURE_DEEP_DIVE.md`](./ARCHITECTURE_DEEP_DIVE.md)
- חוזה REST: [`backend/docs/API.md`](../backend/docs/API.md)
- מדריך מהיר: [`CLAUDE.md`](../CLAUDE.md)
