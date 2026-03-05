# משימות באק־אנד כדי שהפרונט יוכל להתקדם

הפרונט כבר משתמש ב־API קיימים (מסמכים, findings, auth, AI, health). כדי שתוכל להתקדם בפרונט בלי לעצור על mocks וחסרים, הבאק צריך להשלים את הדברים הבאים.

---

## 1. API תלושי משכורת (Payslips)

**סטטוס בפרונט:** `frontend/src/services/payslip.service.ts` כרגע **mock בלבד** – אין קריאות לשרת.

### 1.1 רשימת תלושים + סטטיסטיקות

- **Endpoint:** `GET /api/payslips` (או `GET /api/documents/payslips`)  
  - מוגן ב־auth (משתמש מחובר).
- **לוגיקה:**
  - לשלוף מסמכים של המשתמש עם `status: 'completed'` ו־`analysisData` (תוצאת OCR).
  - למפות כל מסמך ל־**תלוש אחד** לפי `analysisData` (סכמה 1.5 מ־`payslipOcr.js`: `period.month`, `salary.gross_total`, `salary.net_payable` וכו').
  - למיין לפי תקופה (חודש) ולהחזיר את הרשימה + סטטיסטיקות.
- **Response** (בפורמט שהפרונט כבר מצפה לו ב־`PayslipHistoryResponse`):

```json
{
  "success": true,
  "data": {
    "stats": {
      "averageNet": number,
      "averageGross": number,
      "totalPayslips": number
    },
    "items": [
      {
        "id": "string (e.g. document _id or payslip-YYYY-MM)",
        "periodLabel": "string (e.g. 'מרץ 2025')",
        "periodDate": "YYYY-MM-DD",
        "netSalary": number,
        "grossSalary": number,
        "isLatest": boolean,
        "downloadUrl": null | "/api/documents/:id/download"
      }
    ]
  }
}
```

- **חשוב:** `id` יהיה מזהה יציב (למשל `_id` של המסמך או `payslip-{YYYY-MM}`) כדי שהפרונט יוכל לפתוח פרט ולהוריד קובץ.

### 1.2 פרט תלוש בודד

- **Endpoint:** `GET /api/payslips/:id`  
  - מוגן ב־auth.  
  - `:id` = מזהה שחזר מרשימת התלושים (למשל `_id` של מסמך).
- **לוגיקה:**
  - למצוא מסמך ש־`user = req.user.id` ו־`_id = id` (או מיפוי מתאים).
  - אם אין `analysisData` או OCR נכשל – להחזיר 404 או תגובה מתאימה.
  - למפות את `analysisData` (סכמה 1.5) לפורמט שהפרונט מצפה לו ב־`PayslipDetail`.
- **Response** (תואם ל־`PayslipDetail`):

```json
{
  "success": true,
  "data": {
    "id": "string",
    "periodLabel": "string",
    "periodDate": "YYYY-MM-DD",
    "paymentDate": "string or undefined",
    "employerName": "string or undefined",
    "employeeName": "string or undefined",
    "employeeId": "string or undefined",
    "earnings": [ { "label": "string", "amount": number } ],
    "deductions": [ { "label": "string", "amount": number } ],
    "grossSalary": number,
    "netSalary": number,
    "downloadUrl": null | "/api/documents/:id/download"
  }
}
```

- **מיפוי מהבאק:**  
  `salary.components` → `earnings` / `deductions` (לפי סוג רכיב).  
  שדות כמו `employment`, `period`, וכו' – למפות ל־`periodLabel`, `periodDate`, `paymentDate`, `employerName`, `employeeName`, `employeeId` ככל שיש ב־OCR.

אחרי שיהיו שני ה־endpoints האלה, בפרונט אפשר להחליף את ה־mock ב־`payslip.service.ts` בקריאות ל־`/api/payslips` ו־`/api/payslips/:id`.

---

## 2. עדכון פרופיל (Auth)

**סטטוס בפרונט:** `frontend/src/api/profile.api.ts` קורא ל־`PATCH /api/auth/me` – **בבאק אין route כזה**.

### 2.1 PATCH /api/auth/me

- **Endpoint:** `PATCH /api/auth/me`  
  - מוגן (רק משתמש מחובר).
- **Body:** `{ name?: string, email?: string }`  
  - אופציונלי: עדכון שם ו/או אימייל.
- **Validation:**  
  - אם מועבר `email` – לבדוק פורמט אימייל וייחודיות (שלא קיים משתמש אחר עם אותו אימייל).  
  - אם מועבר `name` – אורך סביר (למשל 2–50 תווים).
- **Response:** כמו ב־`GET /api/auth/me`:  
  `{ success: true, data: { user: { id, name, email, avatarUrl? } } }`  
  כדי שהפרונט יעדכן את המשתמש ב־state/localStorage.

כרגע יש רק `GET /api/auth/me` ב־`backend/routes/auth.js` – יש להוסיף שם את ה־`PATCH`.

---

## 3. תמונת פרופיל (Avatar)

**סטטוס בפרונט:** `profile.api.ts` מציין שצריך endpoint ל־Avatar; כרגע התמונה נשמרת מקומית בלבד.

### 3.1 העלאת Avatar

- **Endpoint:** `POST /api/users/me/avatar` (או `POST /api/auth/me/avatar`)  
  - מוגן ב־auth.
- **Body:** `multipart/form-data`, שדה `avatar` (קובץ תמונה).
- **לוגיקה:**  
  - לאשר סוג קובץ (למשל jpeg, png, webp) וגודל מקסימלי.  
  - לשמור את הקובץ (בדיסק או ב־storage), לשמור את ה־URL/path במשתמש (למשל שדה `avatarUrl` ב־User).  
  - אם כבר הייתה תמונה – להחליף (ולמחוק קובץ ישן אם רלוונטי).
- **Response:**  
  `{ success: true, url: "string" }`  
  ה־`url` יהיה כתובת מלאה או path שממנו אפשר לטעון את התמונה (למשל `GET /api/users/me/avatar`).

### 3.2 קריאת Avatar (אם התמונה לא נשמרת כ־URL חיצוני)

- **Endpoint:** `GET /api/users/me/avatar` (או `GET /api/auth/me/avatar`)  
  - מוגן ב־auth.  
  - מחזיר את קובץ התמונה (עם headers מתאימים ל־cache/display).

### 3.3 GET /api/auth/me – להחזיר avatarUrl

- ב־`getMe` (או בכל מקום שמחזיר את אובייקט המשתמש):  
  אם יש למשתמש avatar – להחזיר `user.avatarUrl` (או URL בנוי ל־`GET /api/users/me/avatar`).  
  הפרונט משתמש ב־`AuthUser.avatarUrl` ו־`getAvatarDisplayUrl()` כדי להציג תמונת פרופיל.

אחרי שיהיו PATCH לפרופיל + העלאת/קריאת avatar + `avatarUrl` ב־me – בפרונט אפשר להסיר את השמירה המקומית של התמונה ולהתבסס על הבאק.

---

## 4. מסמכים (Documents) – אופציונלי / שיפורים

- **רשימת מסמכים:** הבאק כבר מחזיר `status`, `uploadedAt`, `processedAt`, `analysisData` (ב־getDocument; ב־list לא מוחזר `analysisData` – אם הפרונט צריך רק רשימה, אפשר להשאיר בלי).  
  אם בדף המסמכים צריך להציג גם `status`/`processedAt` – ה־list כבר מחזיר אותם (בלי `filePath`).
- **הורדה:** `GET /api/documents/:id/download` קיים ועובד.  
  אם תרצה ש־`downloadUrl` בתלושים יהיה path יחסי (למשל `/api/documents/:id/download`), הפרונט יכול לבנות את ה־URL עם base URL של ה־API.

אין חובה לשנות כאן משהו כדי “להתקדם”, אלא רק אם תרצה התאמות (למשל להחזיר פחות שדות ב־list כדי לחסוך נפח).

---

## 5. Findings ו־Health

- **Findings:** `GET /api/findings` קיים ומחזיר `{ success, count, data: [ { id, title, severity, details } ] }` – תואם ל־`FindingItem` בפרונט.
- **Health:** `GET /api/health` קיים.  
  אין משימות פתוחות כאן.

---

## סיכום עדיפויות

| # | משימה | תועלת לפרונט |
|---|--------|----------------|
| 1 | **GET /api/payslips** + **GET /api/payslips/:id** (מ־documents + analysisData) | להחליף mock בתלושים אמיתיים, להציג היסטוריה ופרט תלוש ולהוריד PDF |
| 2 | **PATCH /api/auth/me** (name, email) | דף הגדרות – עדכון שם/אימייל אמיתי |
| 3 | **POST /api/users/me/avatar** + **GET** (אם צריך) + **avatarUrl ב־GET /api/auth/me** | תמונת פרופיל מהשרת במקום מקומית |

אחרי סעיפים 1–3 הבאק יספק את מה שהפרונט צריך כדי להתקדם בלי mocks וחסרים ב־auth/profile ותלושים.
