# רשימת משימות פרונט – FinGuide

מקור: [FRONTEND-PLAN-OCR-PRIORITIES.md](FRONTEND-PLAN-OCR-PRIORITIES.md). סימון התקדמות: `[ ]` → `[x]`.

---

## סדר ביצוע מומלץ

1. **שלב 1** – משימות 1.1–1.4 (מיפוי + payslip.service + downloadUrl).
2. **שלב 2** – משימות 1.5–1.6 (זרימת סריקה + דפי Scan).
3. **שלב 3** – משימות 1.7, 2.1–2.3 (תג דמו, רענון, הודעות, תוויות).
4. **אחר כך** – עדיפות 3 ו־4 לפי צורך.

---

## עדיפות 1 – OCR ותלושים

- [x] **1.1** מיפוי analysisData → PayslipDetail – util שמקבל document + analysisData ומחזיר PayslipDetail (כולל earnings/deductions ותוויות בעברית).
- [x] **1.2** מיפוי documents → PayslipHistoryResponse – פונקציה שמסננת completed + analysisData, ממיינת לפי תקופה, מחשבת stats ובונה items + downloadUrl.
- [x] **1.3** החלפת Mock ב־payslip.service – fetchPayslipHistory ← listDocuments + מיפוי; fetchPayslipDetail(id) ← getDocument(id) + מיפוי + טיפול ב־null/failed.
- [x] **1.4** downloadUrl – בניית URL ל־/api/documents/:id/download (base מה־API/client).
- [x] **1.5** זרימת סריקה – חיבור לאמיתי: כפתור "סריקת הקבצים" ירענן מסמכים ו/או ינווט להיסטוריית תלושים / דאשבורד; או שינוי ל־"צפייה בתוצאות" + ניווט ישיר.
- [x] **1.6** ScanStatusPage / ScanCompletePage – הצגת נתונים אמיתיים ב־ScanComplete ו־CTA להיסטוריה/דאשבורד, או פישוט הזרימה (רענון + redirect בלי דמו).
- [x] **1.7** הסרת/עדכון תג "דמו" – בדף היסטוריית תלושים ובמקומות רלוונטיים.

---

## עדיפות 2 – UX מסמכים

- [x] **2.1** כפתור רענון בדף מסמכים – קורא שוב ל־listDocuments ומרענן רשימה.
- [x] **2.2** הודעות אחרי העלאה – Toast/banner אחרי uploadDocument מוצלח.
- [x] **2.3** תוויות סטטוס בעברית – יישור uploaded/pending/processing/completed/failed לעברית עקבית.

---

## עדיפות 3 – דף ממצאים ועוזר AI

- [x] **3.1** דף ממצאים – קיבוץ לפי severity, חיפוש ב־title/details, כפתור "למסמכים".
- [x] **3.2** עוזר AI – היסטוריית שיחה (sessionStorage/localStorage), הצגת model, כפתור "העתק תשובה".

---

## עדיפות 4 – פרופיל, עזרה, נגישות

- [x] **4.1** פרופיל ו־Avatar – הפרונט מחובר ל־PATCH /api/auth/me ולהעלאת Avatar; יפעל כשהבאק יספק.
- [x] **4.2** דפי עזרה / סטטוס / אינטגרציות – השלמת תוכן סטטי בעברית.
- [x] **4.3** RTL ונגישות – וידוא dir="rtl", labels, aria-labels, ניווט מקלדת.
