# תוכנית עבודה – פרונט FinGuide (עדיפויות + ניתוח OCR)

עודכן לאחר `git pull` – מיקוד בפרונט בלבד, עם דגש על כל מה שקשור ל־OCR.

---

## סיכום מנהלים

| עדיפות | תחום | סטטוס נוכחי | פעולה עיקרית |
|--------|------|-------------|--------------|
| **1 (גבוהה)** | **OCR – חיבור תלושים לנתונים אמיתיים** | Mock בלבד; הבאק כבר מריץ OCR בהעלאה | לממש בפרונט שליפה ומיפוי מ־documents + analysisData |
| **2 (גבוהה)** | **OCR – זרימת "סריקה"** | דמו טיימר, בלי קריאת שרת | לחבר ל־documents אמיתיים או להסיר/לשנות את הכפתור |
| **3 (בינונית)** | **UX מסמכים** | סטטוסים קיימים, חסר רענון/הודעות | כפתור רענון, הודעות אחרי העלאה, יישור תוויות |
| **4 (בינונית)** | **דף ממצאים / עוזר AI** | מחובר ל־API | שיפור קיבוץ, חיפוש, היסטוריית צ'אט |
| **5 (נמוכה)** | **פרופיל, Avatar, עזרה, נגישות** | תלוי בבאק / תוכן | השלמת תוכן ו־RTL/נגישות |

---

# חלק א': ניתוח מעמיק – OCR בפרונט

## 1. איך OCR עובד היום (באק)

- **מתי רץ:** ב־`documentController.uploadDocument` – **מיד אחרי העלאת קובץ**.
- **מה קורה:** קריאה ל־`extractPayslipFile(filePath)` (מ־`payslipOcr.js`):
  - PDF: ניסיון לחלץ טקסט מוטמע; אם אין מספיק טקסט → המרה לתמונות + Tesseract OCR.
  - פלט: אובייקט `data` (סכמה 1.5) נשמר ב־`document.analysisData`, ו־`document.status` מתעדכן ל־`completed` או `failed`.
- **מסקנה:** אין "שלב סריקה" נפרד בשרת – העלאה = העלאה + OCR. הפרונט לא צריך להפעיל "סריקה" נוספת כדי לקבל תוצאות.

## 2. מה הפרונט עושה היום (OCR / תלושים)

| רכיב | מקור נתונים | הערות |
|------|-------------|--------|
| `payslip.service.ts` | **Mock בלבד** – `MOCK_RESPONSE`, `MOCK_DETAILS` | אין קריאות ל־API |
| `usePayslipHistory` | קורא ל־`fetchPayslipHistory()` | Mock → תמיד 6 תלושים קבועים |
| `PayslipDetailPage` | קורא ל־`fetchPayslipDetail(id)` | Mock → פרט קבוע או פלייסהולדר |
| `DocumentsPage` | `listDocuments`, `uploadDocument` | אמיתי – מסמכים עם `status` |
| כפתור "סריקת הקבצים שהועלו" | ניווט ל־`/documents/scan` | **דמו:** רק טיימר ואנימציה |
| `ScanStatusPage` | אין קריאת שרת | 4 שלבים עם `setTimeout` → מעבר ל־ScanComplete |
| `ScanCompletePage` | אין קריאת שרת | סטטיסטיקות קבועות (99%, 8, 24), CTA ל־dashboard |

כלומר: **כל חוויית התלושים (היסטוריה + פרט) והזרימה של "סריקה" הן דמו בלי חיבור ל־OCR/באק.**

## 3. מבנה analysisData (באק) vs PayslipDetail (פרונט)

הבאק מחזיר (סכמה 1.5) בערך כך:

```ts
// מקטע רלוונטי מ־payslipOcr.js
{
  schema_version: '1.5',
  period: { month?: string },           // "YYYY-MM"
  salary: {
    gross_total?: number,
    net_payable?: number,
    components?: Array<{ type: string, amount: number }>  // base_salary, global_overtime, travel_expenses
  },
  deductions: {
    mandatory: {
      total?: number,
      income_tax?: number,
      national_insurance?: number,
      health_insurance?: number
    }
  },
  parties: {
    employer_name?: string,
    employee_name?: string,
    employee_id?: string
  },
  // + employment, tax, contributions, quality, raw...
}
```

הפרונט מצפה ל־`PayslipDetail`:

```ts
{
  id, periodLabel, periodDate, paymentDate?, employerName?, employeeName?, employeeId?,
  earnings: [{ label, amount }],
  deductions: [{ label, amount }],
  grossSalary, netSalary, downloadUrl?
}
```

**מיפוי נדרש:**

- `id` ← `document._id`
- `periodLabel` ← מתוך `period.month` (למשל "2025-03" → "מרץ 2025")
- `periodDate` ← `period.month + "-01"` (או תאריך אחר אם יופיע בבאק)
- `paymentDate` ← לא קיים כרגע בסכמה – להשאיר אופציונלי
- `employerName` ← `parties.employer_name`
- `employeeName` ← `parties.employee_name`
- `employeeId` ← `parties.employee_id`
- `earnings` ← מ־`salary.components`: למפות `type` ל־label בעברית (base_salary → "משכורת בסיס" וכו')
- `deductions` ← מ־`deductions.mandatory`: להפוך שדות (income_tax, national_insurance, health_insurance) ל־`{ label, amount }`
- `grossSalary` ← `salary.gross_total`
- `netSalary` ← `salary.net_payable`
- `downloadUrl` ← לבנות מ־base URL של ה־API: `/api/documents/${id}/download`

## 4. מאיפה לקחת נתונים בלי GET /api/payslips

- **רשימת תלושים:**  
  `GET /api/documents` מחזיר מסמכים עם כל השדות (כולל `analysisData`) מלבד `filePath`.  
  → לסנן מסמכים עם `status === 'completed'` ו־`analysisData` תקף, למיין לפי תקופה, לבנות `PayslipHistoryResponse` (stats + items).
- **פרט תלוש:**  
  `GET /api/documents/:id` מחזיר מסמך בודד כולל `analysisData`.  
  → למפות `analysisData` ל־`PayslipDetail` (כולל טיפול ב־`!document` או OCR שנכשל).

כך אפשר לחבר את כל חוויית התלושים ל־OCR **מבלי להמתין ל־GET /api/payslips** (הבאק יוסיף את ה־endpoints האלה – מעבירים את `payslip.service` לקרוא אליהם).

## 5. זרימת "סריקה" – אופציות

1. **להשאיר כפתור "סריקת הקבצים" אבל לחבר לאמיתי:**  
   הכפתור ירענן רשימת מסמכים (או יבדוק סטטוסים), ואז יעביר ל־"היסטוריית תלושים" או ל־dashboard, עם נתונים אמיתיים (ממסמכים שהועלו וכבר עברו OCR בהעלאה). אין צורך ב־"סריקה" נוספת בשרת.
2. **להסיר את הכפתור ואת דפי הדמו:**  
   להשאיר רק "היסטוריית תלושים" ו"מסמכים", בלי שלב "סריקה" נפרד.
3. **לשנות משמעות הכפתור:**  
   למשל: "צפייה בתוצאות הסריקה" – ניווט ישיר להיסטוריית תלושים (שתיטען מנתוני documents + analysisData).

ההמלצה: **אופציה 1 או 3** – לשמור על חוויית "סריקה" אבל לחבר אותה ל־documents ולהיסטוריית תלושים אמיתית, בלי דמו טיימר.

---

# חלק ב': רשימת משימות ממוקדת פרונט (לפי עדיפות)

## עדיפות 1 – OCR ותלושים (הכי חשוב)

| # | משימה | תיאור קצר |
|---|--------|-----------|
| 1.1 | **מיפוי analysisData → PayslipDetail** | פונקציית util שמקבלת `document` (עם `_id`, `analysisData`) ומחזירה `PayslipDetail` (כולל earnings/deductions מ־components ו־mandatory, תוויות בעברית). |
| 1.2 | **מיפוי רשימת documents → PayslipHistoryResponse** | פונקציה שמקבלת מערך `DocumentItem[]`, מסננת `status==='completed'` ו־analysisData תקף, ממיינת לפי `period.month`, מחשבת stats (averageNet, averageGross, totalPayslips) ובונה `items` עם `downloadUrl`. |
| 1.3 | **החלפת Mock ב־payslip.service** | `fetchPayslipHistory`: קורא ל־`listDocuments()`, מעביר את התוצאה לפונקציית המיפוי (1.2), מחזיר `PayslipHistoryResponse`. `fetchPayslipDetail(id)`: קורא ל־`getDocument(id)`, אם אין analysisData או status לא completed – להחזיר null או להציג "תלוש לא זמין"; אחרת למפות (1.1) ולהחזיר `PayslipDetail`. |
| 1.4 | **downloadUrl** | בבניית ה־URL להשתמש ב־base URL של ה־API (מהסביבה או מ־api client) – למשל `GET /api/documents/:id/download`. |
| 1.5 | **זרימת סריקה – חיבור לאמיתי** | אחרי לחיצה על "סריקת הקבצים שהועלו": לרענן רשימת מסמכים (או לבדוק סטטוסים), ואז לנווט ל־"היסטוריית תלושים" או ל־dashboard; או לשנות את הכפתור ל־"צפייה בתוצאות" ולנווט ישירות להיסטוריה. להסיר/לעדכן את הדמו ב־ScanStatusPage (או לבטל את הדף אם בוחרים רק ניווט). |
| 1.6 | **ScanStatusPage / ScanCompletePage** | אם שומרים על הדפים: להציג נתונים אמיתיים ב־ScanComplete (למשל מספר תלושים שעובדו), ולקשר את ה־CTA להיסטוריה/דאשבורד. אם מעדיפים לפשט – לקצר את הזרימה (למשל רק רענון + redirect) בלי אנימציית שלבים. |
| 1.7 | **הסרת/עדכון תג "דמו"** | בדף היסטוריית תלושים ובמקומות שמציגים "נתוני דמו" – להסיר או לעדכן ל־"נתונים מתלושים שסוננו" אחרי החיבור ל־documents + OCR. |

## עדיפות 2 – UX מסמכים

| # | משימה | תיאור |
|---|--------|--------|
| 2.1 | **כפתור רענון בדף מסמכים** | כפתור "רענן" שקורא שוב ל־`listDocuments` ומרענן את הרשימה (להציג סטטוסים מעודכנים אחרי OCR). |
| 2.2 | **הודעות אחרי העלאה** | אחרי `uploadDocument` מוצלח: Toast או banner – "המסמך הועלה ונבדק. הסטטוס יתעדכן בהמשך" (או "העיבוד הושלם" אם הבאק מחזיר כבר completed). |
| 2.3 | **תוויות סטטוס בעברית** | וידוא שכל הסטטוסים מוצגים בעברית עקבית (uploaded → "הועלה", pending → "ממתין", processing → "בעיבוד", completed → "הושלם", failed → "נכשל"). |

## עדיפות 3 – דף ממצאים ועוזר AI

| # | משימה | תיאור |
|---|--------|--------|
| 3.1 | **דף ממצאים** | קיבוץ לפי severity, חיפוש ב־title/details, כפתור "למסמכים" ל־/documents. |
| 3.2 | **עוזר AI** | שמירת היסטוריית שיחה (sessionStorage/localStorage), הצגת `model` אם רלוונטי, כפתור "העתק תשובה". |

## עדיפות 4 – פרופיל, עזרה, נגישות

| # | משימה | תיאור |
|---|--------|--------|
| 4.1 | **פרופיל ו־Avatar** | תלוי בבאק (PATCH /api/auth/me, Avatar). הפרונט מוכן – רק לחבר כשהבאק יספק. |
| 4.2 | **דפי עזרה / סטטוס / אינטגרציות** | השלמת תוכן סטטי בעברית. |
| 4.3 | **RTL ונגישות** | וידוא dir="rtl", labels, aria-labels, ניווט במקלדת בדפים עיקריים. |

---

# חלק ג': סדר ביצוע מומלץ (OCR תחילה)

1. **שלב 1 – מיפוי ונתונים**
   - לממש util: `analysisData` → `PayslipDetail` (כולל תרגום סוגי components ו־mandatory ל־labels בעברית).
   - לממש util: `DocumentItem[]` → `PayslipHistoryResponse`.
   - לעדכן את `payslip.service.ts`: `fetchPayslipHistory` = listDocuments + מיפוי; `fetchPayslipDetail(id)` = getDocument(id) + מיפוי + טיפול ב־null/failed.

2. **שלב 2 – חוויית סריקה**
   - להחליט אם שומרים על ScanStatus/ScanComplete או מפשטים לכפתור "צפייה בתוצאות" + ניווט.
   - לעדכן את הכפתור בדף מסמכים ואת הזרימה בהתאם (רענון + ניווט להיסטוריה או לדאשבורד).

3. **שלב 3 – ליטושים**
   - downloadUrl נכון בכל מקום שמוצג תלוש.
   - הסרת/עדכון תג "דמו" בדפי תלושים.
   - כפתור רענון והודעות בדף מסמכים.

אחרי ששלב 1–3 יציבים – להמשיך ל־UX ממצאים, עוזר AI, ופרופיל/נגישות לפי הרשימה למעלה.
