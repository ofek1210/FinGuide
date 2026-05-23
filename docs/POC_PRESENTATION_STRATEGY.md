# חומר אסטרטגי למצגת POC – FinGuide

> **הערה חשובה לגבי מקורות:** לא נמצא קובץ בשם "סיכום פגישת התקדמות 1" בתוך הריפו (לא ב-`docs/`, לא ב-root, לא בקבצים אחרים). הניתוח להלן מבוסס על הבעיות שצוינו בבקשה + ראיות מ-Git (PRs, commits, מבנה הקוד, contributors). ניסיון להוציא נתונים חיים מ-Jira נכשל (טוקן API מחזיר 401 ב-`/myself` ו-0 פרויקטים ב-`project/search`). נמצאו רק שמות ה-Epics ב-`.claude/skills/jira-sync/SKILL.md`: **KAN-4 Backend, KAN-85 Frontend, KAN-79 AI, KAN-6 OCR**. כל מקום שבו אין נתון מ-Jira – יצוין במפורש "אין גישה ל-Jira – להוציא Screenshot/CSV מהבורד".

---

## 1. תקציר מנהלים

ה-POC של FinGuide הוא הוכחת היתכנות לפלטפורמה שמקבלת **תלוש שכר ישראלי בעברית בפורמט PDF/תמונה, חולצת ממנו מבנה JSON אחיד, מזהה אנומליות ומשיבה לשאלות חופשיות של המשתמש** דרך סוכן AI על בסיס נתוניו. הסיכונים המרכזיים שזוהו הם: (1) OCR בעברית עם כיוון RTL, ניקוד שבור וטבלאות שונות בכל מעסיק; (2) חוסר פורמט אחיד לתלושים – כל ספק שכר (מלאם, חילן, סינריון וכו') מוציא לייאאוט אחר; (3) תלות במודל LLM חיצוני עם rate-limit נוקשה (5 בקשות לדקה ב-Ollama המוסדי); (4) הגדרת מה בכלל מציגים למשתמש משכבת ה-extraction.

**מה כבר בוצע בפועל (לפי Git):** שכבת OCR ייעודית לתלושים ישראליים נבנתה והוקשחה דרך ~12 PRs (Poppler+Tesseract בתוך Docker, מודול `payslipOcr` שמתפצל לקובץ חילוץ ייעודי לכל מיון: numbers, labelMap, contributions, parties, resolver, summary), שכבת `extraction-v2` ב-shadow-mode נוצרה כתשתית לעדכון חוזה ה-JSON, חיבור ל-Ollama (`llama3.1:8b`) דרך `aiService` בוצע, ונבנה flow מלא של אפלוד → עיבוד אסינכרוני → findings → צ׳אט. בנוסף מומשו onboarding, anomaly detection ו-what-if simulation.

**מה עדיין דורש עבודה:** הפעלת `extraction-v2` מ-shadow-mode ל-primary, התאמה לפורמטים נוספים מעבר ל-2-3 שנבדקו, בניית שכבת **תחזיות פיננסיות** שתסתמך על היסטוריית תלושים מרובים, ניתוח דוחות "הר הביטוח" (אין ראיה ל-PR פעיל בנושא), והשוואה אוטומטית בין JSONים של תלושים עוקבים. ה-Git מראה התקדמות עקבית עם 49 PRs ממוזגים ע"י 5 חברי צוות לאורך 4 חודשים – אך מיפוי Jira-to-Git לא נמצא בריפו עצמו וצריך להציגו דרך ייצוא נפרד.

---

## 2. טבלת בעיות מרכזיות מסיכום פגישה 1

| בעיה שעלתה | למה זו בעיה | החלטה / פתרון שנבחר | ראיות מ-Git | ראיות מ-Jira | סטטוס נוכחי | איך להציג במצגת |
|---|---|---|---|---|---|---|
| OCR לתלושי שכר ישראליים | כל ספק שכר מוציא לייאאוט שונה; טבלאות, מספרים מצטברים, RTL | מודול ייעודי `backend/services/payslipOcr*.js` עם ~7 תתי-קבצים לחילוץ ממוקד | PRs #25, #28, #35, #36, #41, #45, #47; commits `feat(ocr): split multi-month PDFs`, `improve employee and employer name extraction` | אין גישה – Epic **KAN-6 OCR** קיים, צריך screenshot | קיים פיילוט עובד; עדיין מתבייט על מקרי קצה | שקף עם 3 לוגואים של תלושים מסוגים שונים → אותו JSON |
| OCR בעברית | Tesseract Hebrew מחזיר טקסט עם letter-modifiers שבורים, ניקוד, ושיכון תווים הפוך | התקנת Tesseract+Poppler עברית ב-Docker; פוסט-פרוססינג של "Hebrew-broken-encoding detection" | commit `ab0baf5 fix(ocr): detect modifier-letter broken Hebrew encoding`; PR #28 Docker setup | אין גישה – Epic KAN-6 | פתור ברמת PoC, ספציפי לפורמטים שנבדקו | לפני/אחרי של פלט OCR גולמי מול אחרי תיקון |
| פורמטים שונים של תלושים | כל מעסיק = פרסור אחר | תשתית **extraction-v2** עם adapters לכל פורמט, רצה ב-shadow-mode | PR #41 "Extractor v2 shadow mode"; ספרייה `backend/services/extraction-v2/adapters/` | אין גישה – Epic KAN-6 | shadow-mode בלבד; עדיין לא מפעיל את החילוץ הראשי | דיאגרמה: legacy parser → adapter layer → unified JSON |
| יצירת JSON קבוע מתלוש | בלי חוזה יציב הצד הלקוח שובר עם כל שינוי | "Canonical payslip surfaces" + DTOs + serializers + contracts תחת `extraction-v2/contracts` | PR #45/#46 "Stabilize contracts and canonical payslip surfaces"; ספריות `backend/dto`, `backend/serializers` | אין גישה | בוצע – חוזה יציב מוגדר | סכמת JSON מסומנת על שקף אחד |
| שיפור שדות בעייתיים | שמות, חודש, ניכויים מצטברים – נקודות כשל מוכרות | PRs ייעודיים לכל שדה (name, cumulative, deductions, salary components) | commits `feat(ocr): add missing financial fields`, `improve employee and employer name extraction`, `filter cumulative section values from monthly extraction`, `fix cross-line regex match` | אין גישה | התקדמות מתמשכת | טבלת "שדה → ספרינט שבו התייצב" |
| בחירת LLM | מודל קטן מדי = הזיות; גדול מדי = זמן + עלות + rate-limit | `llama3.1:8b` דרך Ollama מוסדי (`http://10.10.248.41`) עם Basic Auth, fallback ל-rule-based | `LLM_SERVICE_INTEGRATION_GUIDE.md`; PR #9 "Add LLM Service Integration Guide"; `backend/services/aiService.js` | אין גישה – Epic **KAN-79 AI** | מחובר, עובד; הפרונט מציג `model` (rule/LLM) | שקף השוואה: rule vs LLM על אותה שאלה |
| הגדרת flow מלא | בלי flow ברור – אין הוכחת היתכנות | Upload → store → async processing → OCR → extraction → JSON ב-`analysisData` → findings → AI chat | PR #39 "Add document metadata upload and async processing"; PR #34 "wire payslip to real documents API" | אין גישה – KAN-4 + KAN-6 + KAN-79 | E2E עובד | flow chart בשקף אחד |
| איזה מידע מציגים | מציגים יותר מדי = רעש; פחות מדי = לא שימושי | סלקציה ל"yearly intelligence", missing-month guidance, anomaly flags, payslip detail page | PR #48 "yearly intelligence with missing-month guidance"; PR #12 "salary anomaly detection"; `frontend/src/pages/PayslipDetailPage.tsx` | אין גישה – KAN-85 | מסך תלוש + דשבורד שנתי קיימים | screenshots של הדשבורד |
| תחזיות פיננסיות | דורש היסטוריה מצטברת + מודל פשוט | `savingsForecastService.js`; PR `Add savings forecast findings flow` | קובץ `backend/services/savingsForecastService.js`; commit `d5a1ef5 Add savings forecast findings flow` | אין גישה | קיים בסיס; מקבל ראיה ראשונה כ-finding | שקף: "מה התחזית אומרת לי בעוד 12 חודשים" |
| סוכן אישי / צ׳אט | תוצאות חייבות להישען על נתוני המשתמש בפועל, לא תשובות גנריות | `POST /api/ai/chat` עם context injection של נתוני התלוש + מס הכנסה ישראלי | commits `feat(ai): enhance LLM context, add Israeli tax brackets, improve Hebrew`, `include employee name in LLM context`; PR #42 "Llm addons" | אין גישה – KAN-79 | עובד; מחזיר answer + model + source | דמו חי או GIF |
| ניתוח דוחות "הר הביטוח" | פורמט שונה לחלוטין מתלוש שכר | **לא נמצאה ראיה מספקת** – אין PR/branch/קובץ עם השם הזה | – | אין גישה | **לא התחיל** | להציג כ-"שלב הבא" במצגת |
| השוואה בין JSONים של תלושים | בלי השוואה אין ערך מצטבר ללקוח | onboarding נועל מסך השוואה עד שיש 2+ תלושים; אנומליה מבוססת ממוצע | PR #38 "locked onboarding flow for payslip comparisons"; PR #12 anomaly detection | אין גישה | UX מוכן, חיווי קיים; השוואה מורחבת – חלקית | screenshot של מסך onboarding נעול |
| חלוקת עבודה ב-Jira | בלי חלוקה – משימות נופלות בין הכיסאות | 4 Epics: Backend / Frontend / AI / OCR (לפי `SKILL.md`) | קונפיגורציית `jira-sync` ב-`.claude/skills/` | **אין גישה ל-Jira** – הראיה היחידה היא רשימת ה-Epics בקונפיגורציה | להציג בשקף עם 4 עמודות; להוציא Export CSV | טבלת 4 Epics + שיוך חברי צוות |
| Milestones ל-POC | POC בלי milestones הופך לפיתוח אינסופי | מ-PRs ניתן לזהות 4 milestones: (1) Backend MVP – ינואר, (2) Frontend MVP + Auth – פברואר, (3) OCR pipeline + Docker – פברואר-מרץ, (4) OCR hardening + LLM context – אפריל-מאי | טווחי תאריכי PRs | אין גישה ל-Jira | מתקדם לעבר milestone 5 (Forecasts + Insurance) | טיימליין אופקי על שקף |

---

## 3. פירוק תאורטי של הבעיות

### OCR לתלושי שכר ישראליים
- **מה הבעיה:** תלוש שכר ב-PDF ישראלי הוא צילום של דו"ח טבלאי בעברית עם מספרים, אחוזים, ניכויים מצטברים והגדרות מעסיק.
- **למה זה מורכב:** RTL גורם ל-Tesseract להחזיר טקסט במיקום הפוך מהציפייה; טבלאות מתערבבות עם שדות free-text; קיימים תווים שבורים (modifier letters); שורות מרובות חודשים בתלוש אחד.
- **סיכון אם לא פותרים:** אם החילוץ לא יציב – אין נתונים אמיתיים להציג, ואין על מה להפעיל AI – ה-POC הופך לתבנית UI ריקה.
- **שאלת מנחה צפויה:** "מה קורה כשמגיע תלוש מספק שלא ראיתם?"
- **תשובה קצרה:** יש שכבת `extraction-v2/adapters` שמאפשרת להוסיף adapter ייעודי לפורמט חדש בלי לפגוע בקיים, ויש shadow-mode שמשווה את הפלט החדש מול ה-legacy לפני החלפה.

### OCR בעברית
- **מה הבעיה:** Tesseract תומך בעברית אך בלי טיפול ייעודי נותן פלט שבור.
- **למה זה מורכב:** modifier letters, ניקוד, סדר תווים, עירוב טקסט+מספרים.
- **סיכון:** איכות תוצאה ישפיע ישירות על אמינות התשובות של ה-LLM.
- **שאלה צפויה:** "ביצועי OCR בעברית מתחת ל-95% – מה השלכת על תשובות?"
- **תשובה קצרה:** הפלט עובר נורמליזציה ייעודית, וה-LLM מקבל context עם flag של ביטחון; חוסר ביטחון מוצג למשתמש כסטטוס "ממתין לאישור".

### פורמטים שונים של תלושים
- **מה הבעיה:** כל מעסיק/ספק שכר מוציא layout שונה.
- **למה זה מורכב:** אין סטנדרט; חלק טבלה, חלק טקסט חופשי, חלק עם תוויות חלקיות.
- **סיכון:** פיצ'ר שעובד על תלוש אחד נשבר על השני.
- **שאלה צפויה:** "מה הכיסוי שלכם – על כמה פורמטים בדקתם?"
- **תשובה קצרה:** שכבת adapters מבודדת את הספציפיקה של כל פורמט; הוספת פורמט = הוספת adapter, לא שינוי ליבה.

### יצירת JSON קבוע מתלוש שכר
- **מה הבעיה:** הצד הלקוח חייב חוזה יציב; כל שינוי בחוזה שובר UI.
- **למה זה מורכב:** השדות עצמם משתנים בין פורמטים – חלקם חסרים.
- **סיכון:** ספירלת רגרסיות.
- **שאלה צפויה:** "איך אתם מבטיחים שהחוזה לא יישבר?"
- **תשובה קצרה:** DTOs + serializers + contracts ב-`extraction-v2/contracts`, ובדיקות regression על fixtures אמיתיים (קיימים בריפו `payslip-he-regression-*.txt`).

### שיפור שדות בעייתיים
- **מה הבעיה:** שמות עובד/מעסיק, חודש, ניכויים מצטברים – נופלים שוב ושוב.
- **למה זה מורכב:** הם תלויי לייאאוט.
- **סיכון:** אם המשכורת לא נכונה – כל חישוב downstream שגוי.
- **שאלה צפויה:** "מהן 3 הבעיות הכי קשות שפתרתם?"
- **תשובה קצרה:** cross-line regex contamination, cumulative section bleeding into monthly, ו-broken Hebrew letter modifiers – שלושתן פתורות עם commits ייעודיים.

### בחירת LLM
- **מה הבעיה:** איזה מודל, איפה הוא רץ, ואיך מטפלים ב-rate limiting.
- **למה זה מורכב:** Ollama המוסדי מאפשר רק 5 בקשות לדקה; מודלים קטנים מהזים בעברית.
- **סיכון:** אם נופלים ל-quota – הצ׳אט פשוט לא עונה.
- **שאלה צפויה:** "למה לא GPT-4? מה ההבדל?"
- **תשובה קצרה:** דרישת מערכת הקורס מחייבת שימוש ב-Ollama המוסדי; `llama3.1:8b` הוא הגדול ביותר שזמין; יש fallback ל-rule-based עבור שאלות נפוצות שלא דורשות LLM.

### הגדרת flow מלא
- **מה הבעיה:** מה קורה מהרגע שהקובץ מועלה ועד שמוצגת תובנה.
- **למה זה מורכב:** Async, status transitions, error states.
- **סיכון:** משתמש לוחץ Upload ולא רואה שום דבר.
- **שאלה צפויה:** "תראו לנו flow מלא".
- **תשובה קצרה:** upload → DB + S3-like storage → async job → OCR → extraction → analysisData → findings refresh → AI ready – הכל מאחורי GET של רשימה אחת.

### איזה מידע מציגים למשתמש
- **מה הבעיה:** רעש vs ערך.
- **למה זה מורכב:** המשתמש לא ערוך לפענח JSON גולמי.
- **סיכון:** מסך עמוס שאף אחד לא קורא.
- **שאלה צפויה:** "מה הערך שהמשתמש מקבל ב-30 שניות?"
- **תשובה קצרה:** דשבורד עם 3 מספרים (ברוטו/נטו/ניכויים), tab של אנומליות, ו-yearly view + missing-month guidance.

### תחזיות פיננסיות
- **מה הבעיה:** "כמה אצבור עד גיל פרישה?", "אם אחסוך X לחודש?".
- **למה זה מורכב:** דורש היסטוריה ארוכה ומודל פשוט אך לא טריוויאלי.
- **סיכון:** תחזית פסולה גרועה יותר מאין תחזית.
- **שאלה צפויה:** "על מה מבוססת התחזית?"
- **תשובה קצרה:** `savingsForecastService` מציג תחזית ראשונית; השלב הבא הוא הרחבה ל-multi-payslip aggregation.

### סוכן אישי / צ׳אט
- **מה הבעיה:** משתמש שואל "מה השכר שלי בחודש שעבר?" – ה-LLM חייב לדעת.
- **למה זה מורכב:** דורש context injection מאיכותי, לא RAG טהור.
- **סיכון:** תשובות גנריות = כישלון POC.
- **שאלה צפויה:** "האם המודל לא ממציא?"
- **תשובה קצרה:** ה-LLM מקבל את ה-JSON המחולץ + מדרגות מס ישראליות 2026 כ-context; pages מציגות `source` (rule/LLM) כדי שהמשתמש יידע.

### ניתוח דוחות "הר הביטוח"
- **מה הבעיה:** דוח מסוג שונה לחלוטין.
- **למה זה מורכב:** Layout אחר, מונחים שונים (קרנות, פוליסות).
- **סיכון:** אם מתחייבים על פיצ'ר ולא מספיקים – פוגע באמינות.
- **שאלה צפויה:** "האם זה בתוך ה-POC?"
- **תשובה קצרה:** מחוץ ל-scope של POC1; **לא נמצאה ראיה מספקת** ב-Git. מוצע להציג כ-Phase 2.

### השוואה בין JSONים שהתקבלו מ-OCR
- **מה הבעיה:** הערך נוצר מהשוואת חודשים.
- **למה זה מורכב:** דורש לפחות 2 תלושים תקינים + מטריקות (anomalies, trends).
- **סיכון:** ללא השוואה – ה-POC הוא רק OCR + UI.
- **שאלה צפויה:** "מה משתמש רואה אחרי 3 חודשים?"
- **תשובה קצרה:** Anomaly detection + yearly intelligence עם missing-month guidance; ההשוואה הצולבת המלאה (delta tables) – פיצ׳ר בהמשך.

---

## 4. הפתרון הטכני במילים

### OCR לתלושי שכר ישראליים
- בחרנו לא להסתמך על OCR גולמי, אלא לבנות **שכבת חילוץ ייעודית לתלוש** עם 7 מודולים נפרדים – אחד לכל סוג שדה (מספרים, תוויות, ניכויים, צדדים, סיכום וכו'). זה מאפשר לבדוק ולשפר כל שדה בנפרד בלי לסכן את האחרים.
- כבר מימשנו: Poppler + Tesseract Hebrew ב-Docker, פיצול PDF רב-חודשי לפני חילוץ, זיהוי וסינון של ערכים מצטברים, וזיהוי שבירת קידוד עברית.
- מה הוכחנו: תלוש ישראלי אמיתי נכנס – יוצא JSON תקין.
- מה לא סגור: כיסוי על פורמטים שלא נבדקו עדיין.
- שלב הבא: הפעלת `extraction-v2` כברירת מחדל (כרגע shadow-mode בלבד).

### OCR בעברית
- בחרנו Tesseract עם חבילת `tesseract-ocr-heb`, ועליה שכבת נורמליזציה שמזהה ומתקנת תווים שבורים. הניקוד לא משוחזר אלא מוסר.
- מימשנו: זיהוי `modifier-letter broken Hebrew encoding`, חלוקת PDF רב-עמודי, פילטור ערכים מצטברים.
- הוכחנו: על fixtures אמיתיים בריפו (`payslip-he-regression-*.txt`) – החילוץ stable.
- לא סגור: ביצועים על תלושים סרוקים מתמונה (לא PDF דיגיטלי).

### פורמטים שונים של תלושים
- בחרנו arch של **adapters**: ליבה אחת שעובדת על "תלוש מנורמל", + מתאם לכל פורמט.
- מימשנו: שלד `extraction-v2` עם תיקיות `adapters/`, `contracts/`, `helpers/`.
- הוכחנו: shadow-mode רץ במקביל ל-legacy ומשווה.
- לא סגור: רק adapter אחד מובנה; הוספת מעסיקים אמיתיים תדרוש עבודה.
- שלב הבא: מיפוי 3-5 פורמטים נפוצים.

### יצירת JSON קבוע מתלוש
- בחרנו לחצוץ בין החילוץ הגולמי לבין הלקוח דרך **חוזה (contract)** שמתועד ב-`contracts/`, ו-DTOs/serializers שמייצגים אותו.
- מימשנו: serializers, DTOs, fixtures regression.
- הוכחנו: שינוי בפנים של ה-extractor לא שובר את ה-UI – עברנו את זה כבר ב-PRs #45/#46.

### שיפור שדות בעייתיים
- במקום one-fix-fits-all – PR לכל שדה בעייתי, עם fixture regression ייעודי. ראיות: `payslip-he-regression-broken-decimals.txt`, `payslip-he-regression-cumulative-contributions.txt`, ועוד 15 כאלה.
- הוכחנו: כל regression שזוהה – נכנס לסט הבדיקות ולא חוזר.

### בחירת LLM
- בחרנו `llama3.1:8b` דרך Ollama המוסדי, עם wrapper שמתפעל Basic Auth, retry-on-429, ו-fallback ל-rule-based.
- הוכחנו: שאלה בעברית "מה השכר שלי החודש?" מקבלת תשובה נכונה עם הקשר אישי.
- לא סגור: streaming responses, conversation memory ארוכת-טווח.

### הגדרת flow מלא
- בחרנו flow אסינכרוני: Upload מחזיר מיד מטא־דאטה, ועיבוד רץ ברקע ומעדכן את `status` ו-`analysisData`.
- מימשנו: `documentProcessingService.js`, סטטוסים `uploaded/pending/processing/completed/failed`, polling-friendly UI.
- הוכחנו: כל המסלול עובד E2E.

### איזה מידע מציגים
- בחרנו hierarchy: דשבורד עם מספרים גדולים → דף תלוש בודד → דף ממצאים → צ׳אט AI. כל שכבה מעמיקה.
- מימשנו: 4 מסכים ראשיים, אנומליות, yearly intelligence, missing-month guidance.

### תחזיות
- בחרנו להתחיל מ-baseline פשוט (חיסכון/קצב) ולחשוף כ-Finding ולא כמסך נפרד, כדי לא להבטיח יותר מהיכולת.
- מימשנו: `savingsForecastService.js`.
- שלב הבא: תחזית מבוססת היסטוריה רב-חודשית.

### סוכן אישי / צ׳אט
- בחרנו prompt engineering עם context injection (נתוני התלוש + מדרגות מס ישראליות) – לא RAG וקטורי בשלב POC.
- מימשנו: `aiService.js`, hybrid rule/LLM, conversation history בצד לקוח.

### ניתוח דוחות "הר הביטוח"
- **לא נמצאה ראיה מספקת.** ההמלצה: לא להבטיח במצגת, להציג כ-Phase 2.

### השוואה בין JSONים
- בחרנו onboarding שנועל את ההשוואה עד שיש מינימום 2 תלושים, ובינתיים anomaly detection מבוסס ממוצע נע.
- מימשנו: PR #38 onboarding נעול, PR #12 anomaly detection.

---

## 5. ניתוח חלוקת העבודה לפי Jira

> **אין גישה חיה ל-Jira** – הטוקן API מחזיר 401. כל מה שניתן לקבוע מהריפו:

מ-`.claude/skills/jira-sync/SKILL.md` עולה שקיימים **4 Epics**:

| Epic | מטרה | משימות עיקריות (לפי Git, לא Jira) | סטטוס | חברי צוות מעורבים | רלוונטיות ל-POC |
|---|---|---|---|---|---|
| **KAN-4 Backend** | Express/Node, controllers, DB, auth, middleware | Auth (register/login/Google/reset), Documents CRUD, Findings, anomaly detection, what-if simulation, profile image, password reset | בעיקר בוצע | Shahar Mayster, SegevPartush, Ofek Dil | קריטי – הציר המרכזי |
| **KAN-85 Frontend** | React, pages, UX, RTL, routing | AuthScreen, Dashboard, DocumentsPage, PayslipDetailPage, Settings, Onboarding, Landing, Assistant | בעיקר בוצע | Ofek Dil (lead), Shahar Mayster | קריטי – חזית הדמו |
| **KAN-79 AI** | LLM, prompts, agents, embeddings | Ollama wrapper, context injection, Israeli tax brackets, hybrid rule/LLM, what-if simulation, conversation history | בוצע ברמת POC | Emily Belenky (lead) | מהותי – זה ה-WOW של המצגת |
| **KAN-6 OCR** | OCR pipeline, extraction, payslip parsing | payslipOcr modules, Docker (Poppler/Tesseract), extraction-v2 shadow mode, regression fixtures | בעיקר בוצע, לא 100% | Ofir Raz, Ofek Dil, Shahar Mayster | קריטי – הוכחת היתכנות |

**פערים שזוהו (היפותטיים, דורש Jira אמיתי לאימות):**
- **אין Epic נראה ל"הר הביטוח"** – אם יש כוונה לבצע, צריך Epic חמישי.
- **אין Epic נראה ל"Forecasts/Insights"** – הוא יושב חלקית תחת Backend, אבל ראוי להפרדה.

**איך להציג Jira במצגת:**
- שקף 1: צילום מסך של הבורד עם 4 העמודות (Epics) ומספר טיקטים מתחת לכל אחד.
- שקף 2: טבלת Burndown – כמה Done / In Progress / To Do לפי Epic.
- שקף 3: שיוך אישי – מי על איזה Epic.

**מה לעשות בפועל:** להיכנס לבורד ב-`finguide.atlassian.net` תחת KAN ולהוציא: (1) screenshot של ה-Backlog; (2) screenshot של ה-Board עם הקבוצות לפי Epic; (3) CSV Export עם עמודות Issue Key, Summary, Status, Assignee, Parent, Created, Resolved.

---

## 6. ניתוח עבודה לפי Git

**ראיות מספריות:**
- 49 PRs ממוזגים ל-main, 5 contributors פעילים, 4 חודשים של עבודה (Jan 28 → May 11, 2026).
- חלוקה לפי commits (top contributors): Shahar Mayster (35), Ofek Dil (33 + 20 + 14 בשמות וריאנטים), Emily (18+12), Ofir (5+4).
- אזורי הקוד הכי פעילים: `frontend/src` (421 commits), `backend/services` (76), `backend/tests` (87), `backend/controllers` (57).

**Commits שמדגימים התקדמות משמעותית:**
- `30939c0 feat: Implement OCR processing for Hebrew payslips` – הצתה של ה-OCR pipeline.
- `b765d6b Add document metadata upload and async processing` – המעבר לעיבוד אסינכרוני.
- `59e13e7 feat(backend): Extractor v2 shadow mode, OCR rawLines, and payslip extraction hardening` – פלטפורמה חדשה לחילוץ.
- `8ad3d12 feat(ai): enhance LLM context, add Israeli tax brackets, improve Hebrew` – חיבור AI לידע הישראלי.
- `993114f feat(payslip): add yearly intelligence with missing-month guidance` – שכבת תובנה.

| תחום | ראיות מ-Git | מה זה מוכיח | קשר לבעיה מה-POC |
|---|---|---|---|
| OCR pipeline | 76 commits ב-`backend/services`, 12 PRs עם `ocr` בכותרת, 18 fixtures regression | השקעה עיקרית; OCR לא "אוסף הצהרות" אלא pipeline אמיתי | OCR ישראלי + פורמטים שונים |
| Frontend integration | 421 commits ב-`frontend/src`, 24 שינויים ב-`DocumentsPage.tsx` | חזית בוגרת ויציבה | מה מציגים למשתמש |
| AI/LLM | `aiService.js` עם 10 שינויים, PR #9 + #42 + commits של context engineering | LLM אינו gimmick אלא משולב | בחירת LLM + סוכן אישי |
| Async processing | PR #39 + `documentProcessingService.js` | Flow מלא קיים | flow מלא מאחורי הקלעים |
| Forecasts | `savingsForecastService.js` + commit `d5a1ef5` | בסיס קיים | תחזיות |
| Onboarding/Comparison | PR #38 "locked onboarding flow for payslip comparisons" | UX מובנה להשוואה | השוואה בין תלושים |
| Insurance ("הר הביטוח") | **לא נמצא** | חסר | להציג כ-Phase 2 |
| Test coverage | 87 commits ב-`backend/tests`, ספריית `coverage/lcov-report` | יש הוכחת איכות | מהימנות POC |

**התאמה בין Git ל-Jira:** לא ניתנת לאימות בלי נתוני Jira חיים. נדרש להוציא CSV מ-Jira ולעשות join מול PR titles. שמות branches תואמים לסגנון "feat/X" שמרמז על שיוך Epic (feat/ocr-* = KAN-6, feat/frontend-* = KAN-85, וכו') – אך זה אמפירי.

**איך להציג Git במצגת:**
- גרף קונטריביוטורים (5 שמות, פסים לפי זמן).
- היסטוגרמת PRs לפי חודש.
- "טופ 10 commits שעוצרים את ה-POC על הרגליים" – להראות גם commits הצלה (`fix: cumulative section bleeding`).

---

## 7. מסקנות למצגת

### חלק תאורטי
- אילו בעיות עלו בפגישה 1.
- למה כל בעיה מורכבת ייחודית (RTL, פורמטים, rate limit).
- סיכונים: ללא OCR מדויק – אין POC; ללא LLM אישי – זה רק parser.
- שאלות שצפויות מהמנחה: "מה הכיסוי?", "מה קורה כשמודל יורד?", "האם זה באמת personalized?".

### חלק טכני
- Flow המלא בדיאגרמה אחת.
- שכבת `payslipOcr` + `extraction-v2`.
- חוזה ה-JSON.
- LLM אינטגרציה + context injection.
- מה הוכחנו: דמו חי, fixtures, anomaly detection, yearly intelligence.

### חלק ניהול פרויקט
- 4 Epics ב-Jira (להציג + להוציא screenshot).
- 49 PRs / 5 חברי צוות / 4 חודשים.
- חלוקת אחריות – מי על מה.
- Milestones שעברנו, ומה מצפה.
- מה לא יספיק לבצע ב-POC הראשון (Insurance, comparison view מורחב).

---

## 8. רשימת שקפים מומלצת

1. **שער + שם הצוות + תאריך**
   - מטרה: זיהוי.
   - תוכן: לוגו FinGuide, שמות חברי צוות, תאריך.
   - מקור: –

2. **מה זה FinGuide ב-30 שניות**
   - מטרה: מסגור.
   - bullets: מעלה תלוש → מקבל JSON → מקבל אנומליות → שואל סוכן AI.
   - ויזואל: 4 איקונים בשורה.
   - מקור: README + roadmap.

3. **הבעיה במציאות**
   - מטרה: כאב הלקוח.
   - bullets: עובד ישראלי מחזיק 12 תלושים בשנה, אף אחד לא יודע אם הוא נגנב.
   - ויזואל: תמונה של תלוש מודפס.
   - מקור: –

4. **סיכוני POC כפי שזוהו**
   - מטרה: לפתוח דיון בעיניים פקוחות.
   - bullets: OCR עברית, פורמטים, LLM, מידע מוצג, תחזיות, השוואה.
   - מקור: סיכום פגישה 1.

5. **שקף Flow E2E**
   - מטרה: ארכיטקטורה.
   - ויזואל: Upload → Backend → OCR → extraction-v2 → contracts → DB → Findings → AI.
   - מקור: `LLM_SERVICE_INTEGRATION_GUIDE.md` + `documentProcessingService.js`.

6. **OCR בעברית – לפני/אחרי**
   - מטרה: הוכחה.
   - ויזואל: OCR גולמי שבור מול אחרי normalize.
   - מקור: commit `ab0baf5`, fixtures.

7. **שכבת Adapters לפורמטים שונים**
   - ויזואל: דיאגרמת legacy → adapter → unified.
   - מקור: `extraction-v2/adapters/`.

8. **חוזה ה-JSON**
   - מטרה: יציבות.
   - ויזואל: JSON sample.
   - מקור: `extraction-v2/contracts/`, DTOs.

9. **בחירת LLM**
   - bullets: Ollama llama3.1:8b, rate limit, fallback rule-based.
   - מקור: `LLM_SERVICE_INTEGRATION_GUIDE.md`, `aiService.js`.

10. **דמו סוכן אישי**
    - מטרה: WOW.
    - ויזואל: GIF/קליפ קצר.
    - מקור: דמו חי.

11. **Yearly Intelligence + Anomalies**
    - ויזואל: צילום מסך של הדשבורד.
    - מקור: PR #48, PR #12.

12. **Onboarding + השוואה בין תלושים**
    - ויזואל: מסך onboarding נעול.
    - מקור: PR #38.

13. **תחזיות – הבסיס הקיים**
    - bullets: `savingsForecastService` כ-Finding.
    - מקור: commit `d5a1ef5`.

14. **Jira – 4 Epics וחלוקת אחריות**
    - ויזואל: screenshot של בורד (נדרש לייצא).
    - מקור: Jira (להוציא screenshot/CSV).

15. **Git – 49 PRs, 5 contributors, 4 חודשים**
    - ויזואל: גרף contributions / טיימליין PRs.
    - מקור: `gh pr list`, `git shortlog`.

16. **Milestones של ה-POC**
    - bullets: M1 Backend MVP (Jan) → M2 Frontend+Auth (Feb) → M3 OCR+Docker (Feb-Mar) → M4 OCR hardening+LLM (Apr-May) → M5 Forecasts+Insurance (הבא).
    - מקור: PR dates.

17. **מה לא ב-POC1 (Phase 2)**
    - bullets: הר הביטוח, multi-payslip comparison view, conversation memory, streaming.

18. **סיכונים פתוחים + מיטיגציות**
    - מטרה: שקיפות.
    - מקור: ניתוח להלן + Git.

19. **שאלות הגנה צפויות + תשובות מוכנות**
    - מטרה: הכנה למנחה.
    - תוכן: 5-6 שאלות מסעיף 3.

20. **שקף סיכום + Call to Action**
    - bullets: מה נראה במצגת, מה השלב הבא, איך הצוות נערך.

---

## הערות סיום

- **אין מסמך "סיכום פגישת התקדמות 1" בריפו** – אם הוא קיים במקום אחר (Drive/Notion/Confluence), שווה להכניס לתיקיית `docs/` כדי שתהיה ראיה מסודרת לציטוטים במצגת.
- **אין גישה ל-Jira API** – יש להוציא **3 ייצואים** לפני המצגת: (1) PNG של הבורד; (2) CSV של כל ה-issues; (3) PNG של הספרינטים (אם יש).
- **לא נמצאה ראיה מספקת** לעבודה על "הר הביטוח" – להציג כ-Phase 2 בלבד, לא להציע כיכולת קיימת.
- ה-Git עצמו הוא הראיה החזקה ביותר במצגת – 49 PRs ממוזגים, fixtures regression מתוחזקים, 4 חברי צוות פעילים ב-3-4 חודשים.
