# FinGuide — מסמך ניתוח עומק טכני ל־POC

מסמך זה מבוסס על קריאה ישירה של קוד הפרויקט: backend (Node/Express + Mongoose), frontend (React 19 + Vite + TypeScript), שירותי OCR, מנוע ה־Extraction (Legacy + v2), שכבת ה־AI, ומבני ה־DB.

המטרה: לשמש בסיס לבניית מצגת POC תאורטית וטכנית ב־NotebookLM.

---

## 1. תקציר מצב הפרויקט הנוכחי

### מה כבר ממומש בפועל וגומר flow מקצה לקצה
- **Auth מלא**: register / login / Google Sign-In (ID Token verification) / forgot-password / reset-password / change-password / update profile + תמונת פרופיל (Sharp + heic-convert). מימוש ב־[backend/controllers/authController.js](../backend/controllers/authController.js) ו־[backend/routes/auth.js](../backend/routes/auth.js).
- **Onboarding** מובנה עם draft + complete (שמירה ב־`User.onboarding`), עם validation שונה ל־draft ול־complete — [backend/controllers/onboardingController.js](../backend/controllers/onboardingController.js).
- **העלאת מסמכים (PDF בלבד)** דרך Multer לדיסק מקומי `backend/uploads/`, יצירת רשומה ב־Mongo, SHA-256 checksum, ו־OCR/parsing סינכרוני בתוך אותו request — [backend/controllers/documentController.js](../backend/controllers/documentController.js).
- **OCR pipeline פעיל**:
  - PDF → ניסיון לחילוץ טקסט מובנה (pdf-parse).
  - אם הטקסט "שבור" (Hebrew encoding broken / מתחת לסף) → fallback ל־`pdftoppm` (Poppler) → `tesseract` (heb+eng) עם שלושה PSM modes (6, 4, 3), ובחירת המועמד הטוב ביותר לפי score.
  - מימוש ב־[backend/services/payslipOcr.js](../backend/services/payslipOcr.js).
- **שכבת Parsing/Extraction Legacy**: מודול ענק לזיהוי שדות תלוש לפי label maps, scoring של candidates, פתרון gross/net, נציגי צד (employer/employee), הפרשות (פנסיה / קרן השתלמות), חודש תקופה, ועוד. תחת `backend/services/payslipOcr*.js`.
- **Extraction v2 ("shadow")**: מנוע parsing נוסף שרץ במקביל ל־legacy וכותב לתוך `analysisData.extraction_v2` כדי לאפשר השוואה ו־validation עצמאי. כולל validation contract עם status `auto_approved / needs_review / failed`. תחת [backend/services/extraction-v2/](../backend/services/extraction-v2/).
- **AI chat (Ollama, מודל llama3.1:8b)** עם RAG מקומי: שולף את הנתונים מ־DB → בונה system prompt עם רכיבי שכר/ניכויים/הפרשות/תלושים קודמים → קודם מנסה לענות לפי **intent classification** וכללי business deterministic, רק שאלות חופשיות עוברות ל־LLM. [backend/controllers/aiController.js](../backend/controllers/aiController.js) + [backend/services/aiService.js](../backend/services/aiService.js).
- **What-if simulator**: parsing של "אם אקבל 10%" / "תוספת 500₪", מחזיר ברוטו/נטו צפויים לפי מדרגות מס 2024 — [backend/utils/simulateWhatIf.js](../backend/utils/simulateWhatIf.js).
- **Findings engine** (rule-based, לא AI): מסמכים חסרי metadata, תאריך עתידי, כפילויות (לפי name+size), פריטים תקועים ב־pending, פריטים stale (>30 ימים) — [backend/controllers/findingsController.js](../backend/controllers/findingsController.js).
- **Savings forecast** לינארי על בסיס פנסיה+קרן השתלמות מהתלוש — [backend/services/savingsForecastService.js](../backend/services/savingsForecastService.js).
- **Frontend** מלא: Landing, Auth, Dashboard (מטריקות, recent docs, chat, payslip history card), Documents, ScanStatus / ScanComplete, Payslip History + Detail + Missing Fields, Assistant, Findings, Settings, Help, Onboarding, Error pages. [frontend/src/App.tsx](../frontend/src/App.tsx).
- **תשתית אבטחה**:
  - JWT עם validation של אורך מפתח לפני boot.
  - Bcrypt(10 rounds) לסיסמאות, `select:false` כברירת מחדל.
  - Rate limit (express-rate-limit) — dev: 2000/15min, prod: 100/15min.
  - CORS allow-list.
  - Path traversal protection בהורדת מסמך.
  - Reset password token: hash בלבד ב־DB (`passwordResetTokenHash`).
- **Tests**: 8 קבצי unit ב־`__tests__/`, ~13 ב־`tests/unit/`, ~8 ב־`tests/integration/`. Stack: jest + supertest + mongodb-memory-server.

### מה חלקי / דורש שיפור
- **עיבוד מסמך הוא סינכרוני בתוך ה־upload**: ה־OCR רץ בתוך אותו HTTP request — חשוף ל־timeout, חוסם את ה־process, ולא תומך נכון בעיבוד מקבילי. קיים `documentProcessingService.processDocumentAsync` שמשתמש ב־`setImmediate`, אבל הוא לא מחובר ל־upload בפועל.
- **אין Queue / Worker אמיתי** (Bull/Redis/SQS). כל מסמך כבד = חוויית "תקיעה" של הפרונט.
- **Extraction v2 הוא shadow בלבד** — לא מחליף את ה־legacy בפועל; ה־UI עדיין צורך את `analysisData.salary.gross_total` וכו', שמגיע מ־legacy.
- **תלוש "ימי עבודה / חופשה / מחלה"**: extraction עם regex פשוטים — שביר.
- **OCR בעברית**: עובד בעיקר ל־PDFs טקסטואליים (Michpal וכד'). תמונות/PDF סרוקים — תלוי בכלי Poppler+Tesseract מותקנים (Docker חובה).
- **Documents storage** = filesystem מקומי (`uploads/`) — לא scalable, לא מתאים ל־prod.
- **אין categorization אוטומטי**: בעת upload המשתמש בוחר category, אין סיווג אוטומטי payslip/tax/pension לפי תוכן.
- **Frontend types** ל־`PayslipSummaryFromBackend` חסר חלק מהשדות שה־backend באמת מחזיר.
- **AI**: תלוי ב־Ollama מקומי. אם השרת לא רץ → fallback לטקסט גנרי. אין caching, אין observability.

### מה רק ברמת תכנון
- **קטגוריות מסמך נוספות**: `tax_report`, `pension_report`, `invoice` קיימים ב־enum אך אין להן pipeline ייעודי. רק `payslip` באמת מנותח.
- **Email integration** (`IntegrationsEmailPage`) — קיים page אבל ה־backend לא חושף endpoints קשורים.
- **Deployment**: יש `Dockerfile` ל־backend ו־`docker-compose.yml` להרצה מקומית; אין CI/CD, אין production config, אין secrets manager.
- **Multi-tenant / role-based access**: אין. כל משתמש רואה רק את המסמכים שלו דרך `user: req.user.id` filter.

---

## 2. החלטות טכנולוגיות

### Frontend
- **טכנולוגיה**: React 19 + TypeScript + Vite 7 + React Router 7 + lucide-react (icons).
- **למה**: React = הסטנדרט; TS = type-safety על מבני OCR מורכבים; Vite = fast HMR; RR v7 לניווט מודרני.
- **יתרונות בפרויקט**: type-checking על schema של תלוש; הפרדה נקייה pages/components/hooks/api; קל לחבר onboarding flow רב־שלבי.
- **מגבלות**: אין state management גלובלי (Redux/Zustand) — כל page טוען מחדש דרך hook; אין SSR; UI טקסטואלי בעברית RTL שדורש זהירות בעיצוב.

### Backend
- **טכנולוגיה**: Node.js 18+ + Express 4 + Mongoose 8.
- **למה**: שפה אחת עם הפרונט, אקוסיסטם עשיר ל־PDF/OCR, חיבור ל־Mongo נטיב.
- **יתרונות**: פיתוח מהיר, ידידותי לשירותי upload, easy spawning של בינארים (tesseract/pdftoppm).
- **מגבלות**: single-threaded → OCR סינכרוני חוסם; אין type safety מובנה (JS לא TS); תלות חיצונית בכלים בינאריים (Poppler, Tesseract) שדורשים Docker.

### Database
- **טכנולוגיה**: MongoDB + Mongoose ODM.
- **למה**: גמיש ל־`analysisData` שמשתנה לפי סוג מסמך וגרסת extractor; JSON-native.
- **יתרונות**: שמירת `analysisData: Object` כברירת מחדל — בלי schema קשיח על תוצאת OCR; קל להוסיף שדות.
- **מגבלות**: אין aggregations חזקות לדוחות; שאילתות trend על תלושים = client-side filtering; אין transactions multi-document אלא במצב replica set.

### Authentication
- **טכנולוגיה**: JWT (jsonwebtoken) + bcryptjs + google-auth-library + crypto לreset tokens.
- **למה**: stateless, מתאים ל־client SPA; Google OAuth → onboarding חלק.
- **יתרונות**: Self-contained tokens; אין session store; Google SSO מוטמע ב־POST `/api/auth/google`.
- **מגבלות**: אין refresh tokens (פג תוקף = login מחדש); JWT ב־localStorage ב־frontend → חשוף ל־XSS; אין revoke list.

### File Upload
- **טכנולוגיה**: Multer (disk storage) + UUID לשם קובץ + Sharp+heic-convert ל־images של פרופיל.
- **למה**: סטנדרט ל־Express; UUID מונע התנגשויות ו־path traversal.
- **יתרונות**: לוקאלי, פשוט, תומך ב־MIME validation.
- **מגבלות**: דיסק מקומי = לא scalable; שיתוף בין instances של השרת לא אפשרי; אין vault. גודל קובץ default 10MB.

### OCR
- **טכנולוגיה**: 1) `pdf-parse` (טקסט מובנה מ־PDF) → 2) Poppler `pdftoppm` (PDF→PNG @300dpi) → 3) Tesseract CLI (`-l heb+eng`, OEM 1, PSM 6/4/3).
- **למה**: open-source, חינמי, תומך עברית; pdf-parse חוסך OCR ב־PDFs טקסטואליים.
- **יתרונות**: ללא תלות ב־cloud APIs; ניתן להריץ מקומית/Docker; חוסך עלות.
- **מגבלות**: Tesseract עברית לא מצטיין על טבלאות צרות; דורש pre-processing (sharp: grayscale + normalize + threshold 170); תלוי ב־Docker כדי שיהיה אחיד בין מפתחים; איטי על PDFs רבי-עמודים.

### AI / Parsing / Extraction
- **טכנולוגיה**: Pipeline היברידית:
  1. **Regex / Label-map extraction** (legacy: `payslipOcrLabelMap`, `payslipOcrResolver`, `payslipOcrParties`, `payslipOcrContributions`).
  2. **Candidate scoring**: לכל שדה נאסף list של candidates → דורגים לפי קרבה ל־label, מיקום במסמך, score relative, mixed alpha-numeric penalty וכו'.
  3. **v2 Extraction** ("shadow") עם confidence scores per-field, evidence (sourceText, line, method, reasoning).
  4. **Validation contract** (CRITICAL_FIELDS: period_month, employee_name, employee_id, gross_total, net_payable) שמחזיר status auto_approved / needs_review / failed.
  5. **LLM** (Ollama llama3.1:8b) רק לשאלות חופשיות ב־chat, **עם RAG** מתוך ה־DB. שאלות קלאסיות נענות בקוד דטרמיניסטי (intent-based).
- **למה**: regex זול ו־explainable; LLM יקר ולא דטרמיניסטי, אבל קריטי לשאלות פתוחות; shadow extractor v2 = דרך לבחון מנוע חדש בלי לשבור production.
- **יתרונות**: לא תלוי OpenAI / Anthropic API; הכל self-hosted; כל ערך מתועד ב־evidence (line + method); deterministic לרוב.
- **מגבלות**: regex maintenance ככל שנוספים פורמטים של תלושים; Ollama מקומי לא scalable; אין semantic search/embeddings; לא משתמשים במודלי OCR חזקים יותר (LayoutLM, AWS Textract).

### Storage
- **טכנולוגיה**: Filesystem (`uploads/`) למסמכים; `uploads/profile-images/` למשתמשים; `.work/` ל־temp PDFs.
- **למה**: פשוט להתחיל, אין צורך בחשבון cloud.
- **יתרונות**: מהיר ב־dev, אפס config.
- **מגבלות**: אין backup, אין encryption-at-rest, אין CDN, לא scalable.

### API structure
- **שכבות**: `routes/` → `middleware/` (auth, validate, upload) → `controllers/` → `services/` → `models/`. Errors דרך `appErrors.js` + `errorHandler.js`.
- **למה**: separation of concerns קלאסי MVC.
- **יתרונות**: קל להוסיף endpoint; ולידציה מובנית עם express-validator; serializers נפרדים (`serializers/documentSerializer.js`).
- **מגבלות**: אין OpenAPI/Swagger מגנרט אוטומטית; documentation ידני ב־`backend/docs/API.md`; אין versioning ל־API.

### Project structure
- Monorepo עם 3 ה־`package.json`: root + backend + frontend, root מאחד עם `npm run dev` ו־concurrently.
- **למה**: deployment מאוחד, פיתוח simul.
- **יתרונות**: install:all, lint:all, פשוט.
- **מגבלות**: shared types בין FE/BE לא מנוצלים בפועל; שכפול של ה־PayslipSummary type.

### Deployment readiness
- יש `Dockerfile` ל־backend שמתקין Poppler+Tesseract.
- `docker-compose.yml` עם service `mongo` + service `backend`.
- אין production env, אין HTTPS termination, אין reverse proxy config, אין CI.

---

## 3. POC תאורטי — פירוק בעיות לחוליות קטנות

### OCR
- OCR בעברית RTL.
- תלושים בפורמטים שונים (Michpal, Hilan, Malam, custom).
- PDF טקסטואלי מול PDF סרוק/תמונה.
- מספרים בעברית/אנגלית (פסיק עשרוני vs נקודה).
- טבלאות לא מסודרות (multi-column → "התפזרות" של תאים בשורה).
- שדות דומים עם משמעות שונה ("ברוטו שוטף" vs "ברוטו לבונוס" vs "סך תשלומים").
- איכות סריקה (resolution, רעש, סקיו).
- "שבירת" קידוד עברית בקבצי PDF מסוימים (modifier letters, Latin-Extended).
- זיהוי חודש התלוש (לחודש 02/2024 / "פברואר 2024" / mm-yy בלי label).
- זיהוי ברוטו / נטו / ניכויים / הפרשות מקבילים (פנסיה employee+employer+severance, study fund שיעור באחוזים).
- PDFs רב־תלושיים (Michpal משלב כמה חודשים).

### Data Extraction
- זיהוי שדה מתוך טקסט לא מובנה (label-map vs regex vs scoring).
- שמות שונים לאותו שדה ("ברוטו שוטף", "סך תשלומים", "סה״כ תשלומים").
- מניעת זיהוי שגוי (כתובת/שם חברה שמכיל מספרים גדולים שזוהו כסכום).
- בניית JSON קבוע מקצה לקצה.
- אמינות הערך — confidence scoring, evidence (line + method + reasoning).
- הצלבת net ≤ gross.
- candidates מרובים לאותו שדה (employee_id סטנדאלוני מול labeled context מול merged identity line).

### Backend
- ניהול מסמכים end-to-end (upload → ניתוח → display).
- מעקב סטטוס עיבוד (uploaded/pending/processing/completed/failed).
- שמירת קבצים מקומית בצורה בטוחה (UUID, אין path traversal).
- שמירת תוצאות ניתוח (`analysisData` כ־free-form object).
- separation: controllers ↔ services ↔ models ↔ middleware.
- טיפול בשגיאות עם class hierarchy (`AuthError`, `FileUploadError`, `NotFoundError`, `ValidationError`).
- OCR סינכרוני שחוסם את ה־event loop.

### Database
- אילו שדות נשמרים על מסמך (`originalName`, `filename`, `filePath`, `checksumSha256`, `mimeType`, `status`, `analysisData`).
- metadata: category enum, periodMonth, periodYear, documentDate, source.
- analysisData = `Object` (free-form) — כולל summary, salary, deductions, contributions, parties, quality, raw text, extraction_v2.
- קישור משתמש→מסמכים (`user: ObjectId` + index).
- פרטיות: היעדר field-level encryption.
- אינדקסים (`{user: 1, uploadedAt: -1}`).

### Auth & Security
- Register/Login עם validation חזק (סיסמה עם uppercase+lowercase+digit+min6).
- Google ID Token verification.
- JWT עם expire דיפולטי 7d.
- Protected endpoints (`router.use(protect)`).
- Rate limit לעיכוב brute-force.
- קבצים פיננסיים: אין encryption-at-rest, אין S3, אין tokenization של ת.ז.
- הרשאות גישה: filter ב־query (`user: req.user.id`) — אין RBAC.
- Path traversal — מנוטרל ב־download בלבד.
- Reset password — token hash בלבד ב־DB + expire.

### Frontend
- הצגת מידע מורכב (תלוש) בצורה פשוטה: PayslipDetail עם earnings + deductions + leave balances + ראש פרטי עובד/מעסיק.
- סטטוס עיבוד בזמן אמת (ScanStatusPage + polling).
- היסטוריית תלושים עם average net/gross.
- pages לשדות חסרים (`PayslipMissingFieldsPage`).
- handling של `null` בכל מקום (כל שדה ב־summary יכול להיות null).
- RTL Hebrew layout.
- RouteGuards (`RequireAuth` / `RequireGuest`).
- error pages (400/401/403/404/500).

### Jira / ניהול עבודה
- חלוקה ל־Epics:
  - **EPIC: Auth & Onboarding**.
  - **EPIC: Document Upload & Storage**.
  - **EPIC: OCR Pipeline**.
  - **EPIC: Field Extraction (Legacy)**.
  - **EPIC: Extraction v2 + Validation Contract**.
  - **EPIC: Frontend Dashboard & Pages**.
  - **EPIC: AI Assistant (RAG + Ollama)**.
  - **EPIC: Findings & Insights**.
  - **EPIC: Savings Forecast / What-If**.
  - **EPIC: DevOps / Docker / Deployment**.
  - **EPIC: Quality / Tests**.
- כל משימה ב־Jira מתחברת ל־POC ע"י תיוג Epic + שיוך הקוד הקיים (filepath:line).
- צורת עבודה: Conventional commits, feature branches, PR template, tests חובה.

---

## 4. POC טכני — פתרון לכל בעיה

### בעיה: OCR בעברית בתלושי שכר ישראליים
- **למה זו בעיה**: עברית RTL, טבלאות, פורמטים שונים (Michpal/Hilan/Malam), טקסט שבור ב־PDFs.
- **הפתרון בקוד**: pipeline דו־שלבי — קודם `pdf-parse` (טקסט מובנה); אם הטקסט קצר מהסף (`OCR_PDF_MIN_TEXT_LENGTH=200`) או "שבור" (`isLikelyBrokenHebrew`) → fallback ל־Poppler+Tesseract עם 3 PSM modes ובחירת best candidate. [backend/services/payslipOcr.js](../backend/services/payslipOcr.js).
- **מצב כרגע**: עובד טוב על PDFs טקסטואליים; חלקי על סרוקים נמוכי איכות.
- **מה לשפר**: הוספת LayoutLM / Tesseract LSTM custom-trained; OCR cloud כ־fallback.
- **איך להציג**: שקף flow → צילום מסך לוג extraction → JSON תוצאה.

### בעיה: PDFs עם כמה תלושים באותו קובץ (Michpal)
- **למה זו בעיה**: זיהוי שגוי של חודש; ערכים מתערבבים בין חודשים.
- **הפתרון בקוד**: `splitPayslipSections` שמזהה marker `/תלוש\s*(?:שכר|משכורת)\s*לחודש\s*(\d{1,2}\/\d{2,4})/g` וחותך לפיו.
- **מצב כרגע**: נבחר תלוש ה־section הראשון בלבד.
- **מה לשפר**: שמירת כל ה־sections כמסמכים נפרדים ב־DB; הוספת `parent_document_id`.

### בעיה: שדות דומים עם משמעות שונה (ברוטו שוטף vs סך תשלומים vs תשלומים שוטף)
- **למה זו בעיה**: יותר מתווית אחת מצביעה על gross_total — בחירה שגויה משבשת את כל הסיכום.
- **הפתרון בקוד**: רשימת `grossLabels` רגקסים, ולכל candidate חישוב score (קרבה ל־label, ערך מינימלי 1000, ערך מקסימלי 50000, mixed alpha-numeric penalty, חלוקה ל־local groups). [backend/services/extraction-v2/extraction.service.js](../backend/services/extraction-v2/extraction.service.js).
- **מצב כרגע**: scoring עובד בפועל ל־Michpal; דורש tuning לפורמטים חדשים.
- **מה לשפר**: למידה לפי דוגמאות מתויגות (golden set).
- **איך להציג**: שקף עם 3 candidates שונים → טבלת scores → הערך הנבחר.

### בעיה: net > gross (לא לוגי)
- **למה זו בעיה**: שגיאה מתמטית = פגיעה באמון.
- **הפתרון בקוד**: `reconcileNetAgainstGross` מבטל את ה־net אם > gross עם reason. Validation contract מוסיף `NET_GREATER_THAN_GROSS` error ב־`validation.service.js`.
- **מצב כרגע**: עובד.
- **איך להציג**: דוגמת JSON עם evidence rejection.

### בעיה: מספרים שמראים כסכום אבל אינם (ת.ז., מספר חברה, ZIP)
- **למה זו בעיה**: מאות זוהו כמשכורת.
- **הפתרון בקוד**: penalty על mixed alpha-numeric, על שורות שנראות כתובת/חברה (`isLikelyAddressLike`, `isLikelyCompanyLike`); רף מינימום (1000) ומקסימום (50000).
- **מצב כרגע**: לא חסין במאה אחוז.
- **מה לשפר**: layout-aware extraction (קואורדינטות תיבות).

### בעיה: זיהוי חודש התלוש
- **למה זו בעיה**: יש כמה פורמטים (לחודש 02/2024, פברואר 2024, 02-24, mm/yy).
- **הפתרון בקוד**: 4 regexes בעדיפות יורדת — Hebrew month → "לחודש NN/YYYY" → YYYY-MM → MM/YY עם label context. כל אחד מקבל confidence שונה.
- **מצב כרגע**: עובד.
- **איך להציג**: 4 דוגמאות → אותה תוצאה `2024-02`.

### בעיה: זיהוי שם עובד וID עובד
- **למה זו בעיה**: השמות לא תמיד labeled; ת.ז. יכולה להופיע במקומות רבים.
- **הפתרון בקוד**: 3 שכבות — (1) labeled context `שם עובד: ...`, (2) merged identity line "name + 7-9 digits", (3) fallback ID standalone block + שכן adjacent person-like line. כל candidate מתויג עם evidence + method.
- **מצב כרגע**: עובד אך עם false-positives בודדים.
- **מה לשפר**: ולידציה לפי checksum של ת.ז. (אלגוריתם נכון); namedb של שמות עבריים.

### בעיה: שמירת קבצים מקומית — סיכון אבטחה
- **למה זו בעיה**: כל אחד עם גישה ל־host רואה את כל ה־PDFs. אין encryption-at-rest.
- **הפתרון בקוד**: UUID לשם קובץ, MIME+ext validation (PDF בלבד), max 10MB, path traversal protection ב־download (`resolvedPath.startsWith(uploadsDir)`).
- **מצב כרגע**: protection בסיסי בלבד.
- **מה לשפר**: S3 + server-side encryption; signed URLs; deletion policy.
- **איך להציג**: שקף "Storage Today vs Storage Tomorrow".

### בעיה: עיבוד OCR סינכרוני חוסם את הבקשה
- **למה זו בעיה**: PDF גדול = HTTP timeout או חוויה תקועה.
- **הפתרון בקוד**: קיים `documentProcessingService.processDocumentAsync` (setImmediate fire-and-forget) אבל `documentController.uploadDocument` עדיין סינכרוני.
- **מצב כרגע**: blocking — צריך לחבר ל־async.
- **מה לשפר**: BullMQ + Redis; status polling ב־frontend (`ScanStatusPage` קיים, מוכן לשימוש).
- **איך להציג**: דיאגרמת before/after עם queue.

### בעיה: סטטוס עיבוד למשתמש
- **למה זו בעיה**: המשתמש לא יודע אם המסמך באוויר.
- **הפתרון בקוד**: שדה `status` ב־Document עם enum, ו־`ScanStatusPage` ב־frontend.
- **מצב כרגע**: רק מצב סופי (completed/failed).
- **מה לשפר**: progress %, WebSocket/SSE לעדכון live.

### בעיה: סוגי מסמכים מרובים (תלוש, דוח מס, פנסיה)
- **למה זו בעיה**: ה־pipeline היחידי הוא תלוש שכר.
- **הפתרון בקוד**: enum `metadata.category` כבר תומך ב־payslip / tax_report / pension_report / invoice / other, אך רק payslip מנותח.
- **מצב כרגע**: בסיס קיים.
- **מה לשפר**: pipelines נוספים; classifier אוטומטי לפי תוכן.
- **איך להציג**: roadmap card עם 4 pipelines.

### בעיה: שאלות חופשיות לעוזר ב־AI
- **למה זו בעיה**: לא הכל ניתן לקבץ ל־intents; שאלות פתוחות צריכות LLM.
- **הפתרון בקוד**: 2 שכבות — קודם `detectIntent(message)` → אם זוהה, תשובה דטרמיניסטית מ־`buildRuleBasedAnswer` עם ה־`buildUserContext` שנשלף מ־DB; אחרת → `askLLM` עם system prompt עשיר + 6 הודעות אחרונות מההיסטוריה.
- **מצב כרגע**: עובד עם Ollama מקומי; אם לא רץ → fallback string.
- **מה לשפר**: streaming responses; הוספת citations; observability.

### בעיה: הזיות (hallucinations) ב־LLM
- **למה זו בעיה**: LLM ימציא ערכים שלא קיימים בתלוש.
- **הפתרון בקוד**: system prompt כולל "אל תמציא נתונים שאינם מופיעים בהקשר"; **כל שאלה דטרמיניסטית נענית בקוד**, כך שה־LLM נוגע רק בשאלות פתוחות; טמפ' נמוכה (0.2).
- **מצב כרגע**: עובד טוב לרוב.
- **מה לשפר**: rejection sampling מול grounded values; eval set.

### בעיה: סיכון בריצת JWT ב־localStorage
- **למה זו בעיה**: XSS = גניבת token.
- **הפתרון בקוד**: כרגע ב־localStorage (פשטות + SPA).
- **מה לשפר**: httpOnly cookie + CSRF token; או refresh token rotation.

### בעיה: אין refresh token
- **למה זו בעיה**: פג תוקף → login מחדש.
- **הפתרון בקוד**: JWT_EXPIRE = 7d, ב־401 ה־frontend עושה `clearSession`.
- **מה לשפר**: refresh token endpoint.

### בעיה: רגרסיה בכל שינוי במנוע ה־extraction
- **למה זו בעיה**: tuning של scoring מסכן תלושים אחרים.
- **הפתרון בקוד**: יש fixtures ב־`backend/tests/fixtures/`; payslipOcrParser/Resolver/Parties/Context יש להם unit tests; **Extraction v2 רץ shadow** ולא משפיע על production output.
- **מצב כרגע**: סבירה — דורש הרחבת golden-set.
- **איך להציג**: שקף "Shadow Pipeline" עם דיאגרמה.

### בעיה: סטטיסטיקה ו־findings על מסמכים
- **למה זו בעיה**: למשתמש חסר context על "מה לא תקין".
- **הפתרון בקוד**: `findingsController` בודק 5 דברים (missing metadata, future date, duplicates, pending stuck, stale).
- **מה לשפר**: findings לפי תוכן (קפיצת שכר חריגה, שינוי באחוז משרה, תוספות חסרות).

### בעיה: חישוב תחזית חיסכון
- **למה זו בעיה**: למשתמש קשה לחשב לבד.
- **הפתרון בקוד**: `savingsForecastService` + `linearSavingsForecast` — מקבל גיל פרישה, תשואה צפויה, מסה התחלתית; מחזיר טבלת ערכים.
- **מצב כרגע**: לינארי בלבד.
- **מה לשפר**: ריבית דריבית, תרחישי שוק, hedging.

### בעיה: סימולציית "מה אם"
- **הפתרון בקוד**: `parseWhatIfChange` מפענח אחוז/סכום מטקסט בעברית; `simulateWhatIf` מחשב לפי מדרגות מס 2024.
- **מצב כרגע**: עובד למקרים הפשוטים.
- **מה לשפר**: התחשבות בקרן השתלמות, נקודות זיכוי דינמיות, ביטוח לאומי שלם.

### בעיה: גישה בלתי מורשית למסמכים של משתמש אחר
- **הפתרון בקוד**: כל query כוללת `user: req.user.id`. ב־`getDocument`/`deleteDocument`/`downloadDocument` בודקים ב־`findOne({_id, user})`.
- **מצב כרגע**: נכון.
- **מה לשפר**: audit log על access.

### בעיה: אונבורדינג ארוך
- **הפתרון בקוד**: `PUT /api/onboarding` ל־draft (partial), `POST /api/onboarding/complete` עם validation מלא; הפרדה בין draft validation (טווחים, types) ל־complete validation (required fields לפי salaryType).
- **מצב כרגע**: עובד.
- **איך להציג**: שלבי wizard → save draft → resume.

### בעיה: validation של נתונים פיננסיים נכנסים
- **הפתרון בקוד**: express-validator על body, `validate` middleware מאחד שגיאות, יחד עם type checks ב־onboarding controller.
- **מה לשפר**: schema validation עם Zod/Joi משותף ל־FE/BE.

### בעיה: זיהוי שינוי קובץ / כפילויות
- **הפתרון בקוד**: SHA-256 checksum נשמר ב־`checksumSha256`; findingsController מזהה כפילויות לפי name+size (לא checksum כרגע).
- **מה לשפר**: dedup לפי checksum + הצעה למשתמש.

---

## 5. מיפוי פלואו מלא של המערכת

```
User Register/Login (POST /api/auth/register | /login | /google)
  ├─ controllers/authController.js → bcrypt/Google verify → JWT
  └─ frontend stores token in localStorage (utils/logout.ts.clearSession on 401)

User Onboarding (PUT/POST /api/onboarding)
  └─ controllers/onboardingController.js writes User.onboarding

User Uploads PDF (POST /api/documents/upload, multipart/form-data)
  ├─ middleware/upload.js (Multer disk, UUID name, PDF MIME, max 10MB)
  ├─ controllers/documentController.uploadDocument
  │   ├─ computeFileChecksum (SHA-256)
  │   ├─ Document.create({status:'pending'})
  │   ├─ services/payslipOcr.extractPayslipFile(filePath)
  │   │   ├─ if PDF: try pdf-parse → if text length ≥ 200 AND not broken Hebrew
  │   │   │   └─ splitPayslipSections → take section[0] → extractPayslipFinancialEN
  │   │   └─ else: pdftoppm → preprocessImage (sharp gray+normalize+thresh) → tesseract heb+eng PSM[6,4,3] → rank candidates
  │   ├─ extraction-v2/extractPayslipFields (shadow)
  │   ├─ extraction-v2/validatePayslipExtraction
  │   ├─ buildPayslipSummary (summary subset of fields)
  │   ├─ document.analysisData = data; status='completed'
  │   └─ res 201 { success, data: serializedDocument }

User Views Dashboard (GET /api/auth/me, /api/documents, /api/findings)
  └─ frontend pages/DashboardPage uses hooks: useDashboardUser/Documents/Health/PayslipsPreview

User Views Payslip History
  ├─ GET /api/documents → frontend filters (isPayslipDocument) → sortPayslipDocuments
  └─ frontend utils/documentToPayslip.ts maps analysisData → PayslipHistoryItem/PayslipDetail

User Asks AI (POST /api/ai/chat { message, history })
  ├─ aiController.buildUserContext (RAG: latest payslip + 2 prior)
  ├─ detectIntent(message)
  ├─ rule-based answer (deterministic) | LLM (Ollama llama3.1:8b)
  └─ returns answer + intent + source

User Downloads (GET /api/documents/:id/download)
  ├─ path-traversal check
  └─ res.download(filePath)

User Deletes (DELETE /api/documents/:id)
  ├─ Document.findOne + fs.unlink + deleteOne

Findings (GET /api/findings)
  └─ findingsController scans docs for 5 issue types
```

לכל שלב — מי אחראי, איזה קבצים, איזה כשלים יכולים לקרות, ופתרון נוכחי:

| שלב | רכיב | קבצים | כשלים אפשריים | פתרון נוכחי |
|---|---|---|---|---|
| Register | `authController.register` | controllers/authController.js, routes/auth.js | אימייל כפול, סיסמה חלשה | response 400 + bcrypt 10 rounds |
| Login | `authController.login` | controllers/authController.js | brute-force | rate-limit, message ניטרלי |
| Upload | `documentController.uploadDocument` | controllers/documentController.js, middleware/upload.js | קובץ לא PDF, חורג מגודל, OCR נכשל | MIME validation + status='failed' + שמירת cause |
| OCR | `extractPayslipFile` | services/payslipOcr.js | pdftoppm לא מותקן, broken Hebrew, OCR timeout | embedded text first + heuristic fallback + 3 PSM passes |
| Parsing | `extractPayslipFinancialEN`, `extraction-v2` | payslipOcr*.js, extraction-v2/* | candidates שגויים | scoring + reconciliation + validation contract |
| Persistence | Mongoose `Document` | models/Document.js | DB down | startup validation, retry server.js |
| Display | hooks + utils/documentToPayslip | frontend/src/* | nulls, missing fields | safe `?? null`, `PayslipMissingFieldsPage` |
| Chat | aiController + Ollama | controllers/aiController.js, services/aiService.js | Ollama down, hallucinations | rule-based first + grounded prompt + fallback string |

---

## 6. API ו־Data Models

### Endpoints (all under `/api`, JSON unless noted)

| Method | Path | Auth | Input | Output | Entity |
|---|---|---|---|---|---|
| GET | `/health` | no | — | `{success, message, timestamp}` | — |
| POST | `/auth/register` | no | `{name, email, password}` | `{user, token}` | User |
| POST | `/auth/login` | no | `{email, password}` | `{user, token}` | User |
| POST | `/auth/google` | no | `{credential}` (ID token) | `{user, token}` | User |
| POST | `/auth/forgot-password` | no | `{email}` | `{success, message}` | User |
| POST | `/auth/reset-password` | no | `{token, newPassword}` | `{success}` | User |
| GET | `/auth/me` | yes | — | `{user}` | User |
| PATCH | `/auth/me` | yes | `{name?, email?}` | `{user}` | User |
| POST | `/auth/change-password` | yes | `{currentPassword, newPassword}` | `{success}` | User |
| POST | `/auth/profile/image` | yes | multipart `avatar` | `{user}` | User |
| GET | `/onboarding` | yes | — | `{completed, data}` | User.onboarding |
| GET | `/onboarding/status` | yes | — | `{completed}` | User.onboarding |
| PUT | `/onboarding` | yes | `{data:{...}}` partial | `{completed, data}` | User.onboarding |
| POST | `/onboarding/complete` | yes | `{data:{...}}` | `{completed, data}` | User.onboarding |
| POST | `/documents/upload` | yes | multipart `document` + metadata | `{data: DocumentItem}` | Document |
| GET | `/documents` | yes | — | `{count, data:[DocumentItem]}` | Document |
| GET | `/documents/:id` | yes | — | `{data: DocumentItem}` | Document |
| GET | `/documents/:id/download` | yes | — | binary PDF | Document |
| DELETE | `/documents/:id` | yes | — | `{success}` | Document |
| POST | `/ai/chat` | yes | `{message, history?}` | `{answer, intent, source}` | — |
| GET | `/findings` | yes | — | `{count, data:[Finding]}` | Document (aggregated) |
| POST | `/findings/savings-forecast` | yes | `{...inputs}` | forecast table | Document + input |

### User model
```
{
  name, email, googleId?, password (hidden, bcrypt), avatarUrl,
  passwordResetTokenHash, passwordResetExpiresAt,
  onboarding: {
    completed, completedAt, updatedAt,
    data: { salaryType:'global'|'hourly', expectedMonthlyGross,
            hourlyRate, expectedMonthlyHours, jobPercentage,
            isPrimaryJob, hasMultipleEmployers, employmentStartDate,
            hasPension, hasStudyFund }
  },
  createdAt, updatedAt
}
```

### Document model
```
{
  user: ObjectId(User) [indexed],
  originalName, filename(unique), filePath, fileSize, mimeType,
  metadata: {
    category: 'payslip'|'tax_report'|'pension_report'|'invoice'|'other',
    periodMonth, periodYear, documentDate,
    source: 'manual_upload'
  },
  checksumSha256,
  status: 'uploaded'|'pending'|'processing'|'completed'|'failed',
  uploadedAt, processedAt,
  analysisData: { ...free-form OCR result... },
  processingError?: string,
  createdAt, updatedAt
}
// index: { user: 1, uploadedAt: -1 }
```

### analysisData structure (תלוש שכר)
```
{
  schema_version: '1.9',
  pipeline_version: 'extractor-v2-shadow',
  period: { month: 'YYYY-MM' },
  salary: {
    gross_total, net_payable, gross_minus_mandatory_deductions,
    components: [{ type:'base_salary'|'global_overtime'|..., amount }]
  },
  deductions: {
    mandatory: { total, total_is_derived, income_tax, national_insurance, health_insurance },
    voluntary: {}
  },
  contributions: {
    pension: { base_salary_for_pension, employee, employer, severance, base_for_severance },
    study_fund: { base_salary_for_study_fund, employee, employer, employee_rate_percent, employer_rate_percent }
  },
  tax: { gross_for_income_tax, taxable_income, marginal_tax_rate_percent,
         tax_credit_points, tax_credit_points_breakdown: {resident, woman} },
  national_insurance: { gross_for_national_insurance },
  employment: { employment_start_date, job_percent },
  parties: { employer_name, employee_name, employee_id },
  insurances: { hmo },
  quality: {
    confidence, resolution_score, warnings:[...],
    validation: { isValid, status, needsReview, warnings, errors },
    debug: { source_type, sections, extraction_v2_shadow:{...}, study_line, pension_lines_sample }
  },
  extraction_v2: {
    meta: { extractor:'payslip-extractor-v2', version:'0.2.0-critical-fields', debug:{...} },
    fields: { period_month, employee_name, employee_id, gross_total, net_payable }
       // each: { value, sourceText, confidence, reasoning, source:{line, method} }
  },
  raw: {
    ocr_engine: 'tesseract-cli', ocr_lang: 'heb+eng',
    text_sha256, rawText, ocr_text, rawLines, extractionMethod, total_sections?
  },
  summary: { ...subset for UI consumption... }
}
```

### Validation result contract
```
{
  isValid: bool,
  status: 'auto_approved'|'needs_review'|'failed',
  needsReview: bool,
  warnings: [{code, field, message}],
  errors: [{code, field, message}]
  // codes: MISSING_CRITICAL_FIELD, LOW_CONFIDENCE_CRITICAL_FIELD,
  //        MALFORMED_EMPLOYEE_ID, INVALID_EMPLOYEE_NAME,
  //        NET_GREATER_THAN_GROSS, INVALID_GROSS_TOTAL, INVALID_NET_PAYABLE,
  //        NEGATIVE_DEDUCTION_VALUE, SUSPICIOUS_TAX_CREDIT_POINTS,
  //        MISSING_SOURCE_TEXT, EXTREMELY_LOW_CONFIDENCE
}
```

---

## 7. AI / OCR / Extraction — הסבר מעמיק

### מנוע OCR בפועל
- **Library / tool**: Tesseract CLI דרך `execFile` (לא tesseract.js). מודלי שפה: `heb+eng`. OEM=1 (LSTM). PSM=6/4/3 (במקביל, בוחר best).
- **Preprocessing**: `sharp.rotate().grayscale().normalize().threshold(170).png()` לפני שליחה לטסרקט.
- **PDF → image**: Poppler `pdftoppm -png -r 300` (fallback ל־PPM אם הבינארי לא תומך).

### text-first extraction
- **כן** — לפני OCR מנסים `pdf-parse` ולוקחים את הטקסט הטמון ב־PDF.
- ספי החלטה: אורך מינ' `OCR_PDF_MIN_TEXT_LENGTH=200` תווים (אחרי normalize whitespace) **וגם** הטקסט לא "שבור" לפי `isLikelyBrokenHebrew` (פחות מ־5 תווי עברית + יותר מ־30 modifier letters או 20 Latin-extended).
- אם עובר → `extractionMethod='pdf_text'`. אחרת → fallback ל־OCR (`extractionMethod='ocr'`).

### Fallback
- **כן** — OCR הוא ה־fallback ל־pdf-parse כושל/שבור.
- אם **גם** OCR נכשל בכל ה־PSM passes → throw error, status='failed', `processingError` נשמר.

### איך מפורק הטקסט
- **`buildNormalizedOcrDocumentFromSource`** → מבני lines + fullText + sections.
- **`extractFromLinesByLabelMap`** → מפת labels מובנית עברית→שדה (`payslipOcrLabelMap`).
- **Collectors** ל־candidates: `collectCoreFieldCandidates`, `collectPeriodMonthCandidates`, `collectSupplementalFieldCandidates`, `collectPartyCandidates`, `collectContributionCandidates`.
- **Resolvers** ל־scoring + בחירה: `resolveBestNumericCandidate`, `resolveGrossAndNetCandidates`, `resolveMandatoryTotalCandidate`, `resolvePartyCandidates`, `resolveContributionCandidates`.

### איך מזהים שדות
- שילוב של 3 שיטות:
  1. **Label map** — pairs of (Hebrew label regex → field key).
  2. **Same-line amount** — אם תווית + סכום באותה שורה (`extractAmountWithLabels`).
  3. **Nearby-line amount** — סורק עד 28-40 שורות אחרי תווית (SCAN_BOUND), עוצר ב־boundary regex (`תלוש:|סכומים מצטברים|סך נקודות זיכוי`), אוסף sumbers, מסנן לטווח [1000, 50000], מדרג עם score פר field.

### איך נבנה ה־JSON
- כל candidate מוחזר כ־`evidence = { value, sourceText, confidence, reasoning, source:{line, method} }`.
- ה־top candidate לכל שדה נכנס ל־`fields`.
- Aggregator בונה את `extractionResult = { meta:{extractor,version,extractionMethod,debug}, fields:{...} }`.
- Legacy בונה במקביל את ה־schema המלאה (`salary/deductions/contributions/tax/parties/...`).
- Both נשמרים תחת `analysisData` (extraction_v2 = shadow).
- **Summary**: `buildPayslipSummary` בונה view פלאט שמתאים ל־UI.

### שדות שכבר מזוהים (production-ready)
- **Period**: `period.month` (`YYYY-MM`).
- **Salary**: `gross_total`, `net_payable`, `gross_minus_mandatory_deductions`.
- **Mandatory deductions**: `income_tax`, `national_insurance`, `health_insurance`, `total`.
- **Components**: base_salary, global_overtime, travel_expenses, bonus, holiday_pay, overtime_125, overtime_150, convalescence, clothing_allowance.
- **Parties**: `employer_name`, `employee_name`, `employee_id`.
- **Pension**: employee, employer, severance + bases.
- **Study fund**: employee, employer + rates.
- **Tax**: marginal rate, credit points + breakdown (resident, woman).
- **Employment**: start date, job percent.
- **HMO** (קופ"ח).

### שדות בעייתיים
- **vacationDays / sickDays / workingDays / workingHours** — regex-only, שביר (`buildPayslipSummary`).
- **`taxable_income`** — regex פשוט, לא ranked.
- שדות חדשים בפורמטים לא-Michpal — Hilan/Malam עדיין דורשים tuning.

### איך מסבירים במצגת בלי קוד
- שקף 1: "תלוש שכר → טקסט": תמונת PDF + חיצים ל־pdf-parse / Tesseract.
- שקף 2: "טקסט → רשימת candidates": טבלה של רגקסים → candidates → scores.
- שקף 3: "Candidates → JSON": JSON תוצאה עם 5 שדות חיוניים.
- שקף 4: "Validation": תרשים auto_approved / needs_review / failed.
- שקף 5: "Shadow Pipeline": legacy + v2 רצים במקביל, לא משבשים production.
- שקף 6: "AI Layer": intent classification → rule-based / LLM, RAG מ־DB, grounded prompt.

---

המסמך מבוסס לחלוטין על קוד שנקרא בפרויקט. הוא משמש בסיס מצוין לבניית מצגת NotebookLM — אפשר להזין אותו ולבקש שקפים בנושאים ספציפיים.
